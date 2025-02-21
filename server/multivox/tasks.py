import asyncio
import base64
import io
import logging

import pydantic
import torch
import torchaudio
from fastapi import WebSocketDisconnect
from fastapi.websockets import WebSocketState
from google import genai
from google.genai import live as genai_live
from google.genai import types as genai_types
from silero_vad import get_speech_timestamps, load_silero_vad
from websockets import ConnectionClosedOK

from multivox.config import settings
from multivox.hint import generate_hints
from multivox.message_socket import TypedWebSocket
from multivox.transcribe import (
    convert_to_wav,
    transcribe,
    transcribe_and_hint,
)
from multivox.translate import translate
from multivox.tts import generate_tts_audio_async
from multivox.types import (
    CLIENT_SAMPLE_RATE,
    SERVER_SAMPLE_RATE,
    AudioWebSocketMessage,
    ErrorWebSocketMessage,
    HintRequest,
    HintWebSocketMessage,
    Language,
    MessageRole,
    MessageType,
    TextWebSocketMessage,
    TranscribeAndHintRequest,
    TranscribeRequest,
    TranscriptionWebSocketMessage,
    TranslateRequest,
    WebSocketMessage,
)

vad_model = load_silero_vad()

logger = logging.getLogger(__name__)


class MessageBuffer:
    """Manages both text and audio content for a speaker"""

    def __init__(self, role: MessageRole, sample_rate: int | None = None):
        self.role = role
        self.sample_rate = sample_rate
        self.current_audio: bytes = b""
        self.turn_complete = False

    def add_audio(self, audio: bytes):
        self.current_audio += audio

    def end_turn(self) -> bytes:
        audio = self.current_audio
        self.current_audio = b""
        self.turn_complete = False
        return audio


class MessageSubscriber:
    """Base class for message subscribers"""

    async def handle_message(self, message: WebSocketMessage) -> None:
        raise NotImplementedError()


class ChatState(pydantic.BaseModel):
    """Holds the conversation state and manages message distribution."""

    model_config = pydantic.ConfigDict(
        arbitrary_types_allowed=True,
    )

    modality: str
    user_ws: TypedWebSocket
    session: genai_live.AsyncSession | None
    history: list[WebSocketMessage] = pydantic.Field(default_factory=list)
    subscribers: list[MessageSubscriber] = pydantic.Field(default_factory=list)

    def add_subscriber(self, subscriber: MessageSubscriber) -> None:
        """Add a new message subscriber"""
        self.subscribers.append(subscriber)

    async def handle_message(self, message: WebSocketMessage) -> None:
        """Distribute message to all subscribers"""
        logger.info(
            "Handling message: %s, %s, end: %s",
            message.type,
            message.role,
            message.end_of_turn,
        )
        self.history.append(message)

        # Distribute to all subscribers
        for subscriber in self.subscribers:
            try:
                await subscriber.handle_message(message)
            except Exception:
                logger.exception(
                    f"Error in subscriber {subscriber.__class__.__name__}",
                    stack_info=True,
                )


class LongRunningTask:
    """Base class for long-running tasks that can be stopped"""

    def __init__(self, state: "ChatState"):
        self.state = state
        self._stop = False

    def running(self):
        return not self._stop

    def stop(self):
        self._stop = True

    async def start(self) -> list[asyncio.Task]:
        raise NotImplementedError()


class BulkTranscriptionTask(LongRunningTask, MessageSubscriber):
    """Handles transcription and hints for assistant messages"""

    def __init__(
        self,
        state: ChatState,
        practice_language: Language,
        native_language: Language,
        client: genai.Client,
    ):
        LongRunningTask.__init__(self, state)
        self.practice_language = practice_language
        self.native_language = native_language
        self.client = client
        self.buffer = MessageBuffer(MessageRole.ASSISTANT, SERVER_SAMPLE_RATE)
        state.add_subscriber(self)

    async def start(self):
        return []  # No background tasks needed

    async def _process_turn(self, audio: bytes | None, text: str | None, role: MessageRole):
        """Process a complete turn"""
        try:
            if audio:
                transcript = await transcribe(
                    TranscribeRequest(
                        audio=audio,
                        mime_type=f"audio/pcm;rate={settings.SERVER_SAMPLE_RATE}",
                        source_language=self.practice_language.abbreviation,
                        target_language=self.native_language.abbreviation,
                    )
                )
                msg = TranscriptionWebSocketMessage(
                    source_text=transcript.source_text,
                    translated_text=transcript.translated_text,
                    chunked=transcript.chunked,
                    dictionary=transcript.dictionary,
                    role=role,
                    end_of_turn=True,
                )
            elif text:
                translation = await translate(
                    TranslateRequest(
                        text=text,
                        source_language=self.practice_language.abbreviation,
                        target_language=self.native_language.abbreviation,
                    )
                )
                msg = TranscriptionWebSocketMessage(
                    source_text=translation.source_text,
                    translated_text=translation.translated_text,
                    chunked=translation.chunked,
                    dictionary=translation.dictionary,
                    role=role,
                    end_of_turn=True,
                )
            else:
                return

            await self.state.handle_message(msg)

            # Generate hints for assistant messages
            if role == MessageRole.ASSISTANT:
                history_items = []
                scenario = ""
                for hist_msg in self.state.history:
                    if hist_msg.type == MessageType.INITIALIZE:
                        scenario = hist_msg.text
                    if hist_msg.type == MessageType.TRANSCRIPTION:
                        history_items.append(f"> {hist_msg.role}: {hist_msg.source_text}")
                    elif hist_msg.type == MessageType.TEXT:
                        history_items.append(f"> {hist_msg.role}: {hist_msg.text}")

                history_prompt = "\n".join(history_items)
                hints = await generate_hints(
                    HintRequest(
                        history=history_prompt,
                        scenario=scenario,
                        source_language=self.practice_language.abbreviation,
                        target_language=self.native_language.abbreviation,
                    )
                )
                hint_msg = HintWebSocketMessage(
                    role=MessageRole.ASSISTANT,
                    hints=hints.hints,
                    end_of_turn=True,
                )
                await self.state.handle_message(hint_msg)

        except Exception as e:
            logger.exception("Error processing turn")
            error_msg = ErrorWebSocketMessage(
                text=f"Sorry, I ran into an error: {e}",
                role=role,
            )
            await self.state.handle_message(error_msg)

    async def handle_message(self, message: WebSocketMessage) -> None:
        """Handle incoming messages"""
        # Skip messages we don't need to process
        if message.type in (MessageType.TRANSCRIPTION, MessageType.HINT):
            return
        if message.role != MessageRole.ASSISTANT:
            return

        # Handle audio messages
        if message.type == MessageType.AUDIO:
            self.buffer.add_audio(message.audio)
            if message.end_of_turn:
                audio = self.buffer.end_turn()
                if audio:
                    logger.info("Processing audio turn: %d bytes", len(audio))
                    await self._process_turn(audio, None, message.role)
        # Handle text messages
        elif message.type == MessageType.TEXT and message.end_of_turn:
            logger.info("Processing text turn: %s", message.text)
            await self._process_turn(None, message.text, message.role)


class GeminiReaderTask(LongRunningTask, MessageSubscriber):
    """Reads from Gemini and publishes messages to state"""

    def __init__(
        self,
        state: ChatState,
        session: genai_live.AsyncSession,
    ):
        LongRunningTask.__init__(self, state)
        self.session = session
        state.add_subscriber(self)

    async def start(self):
        return [asyncio.create_task(self._process())]

    async def _process(self):
        while self.running():
            try:
                async for response in self.session.receive():
                    end_of_turn = bool(
                        response.server_content
                        and response.server_content.turn_complete
                    )
                    if response.data:
                        logger.debug(
                            "Received %d bytes of audio from Gemini", len(response.data)
                        )
                        message = AudioWebSocketMessage(
                            audio=base64.b64encode(response.data),
                            role=MessageRole.ASSISTANT,
                            end_of_turn=end_of_turn,
                            mime_type=f"audio/pcm;rate={settings.SERVER_SAMPLE_RATE}",
                        )
                        await self.state.handle_message(message)
                    else:
                        logger.debug("Received text from Gemini: %s", response.text)
                        message = TextWebSocketMessage(
                            text=response.text or "",
                            role=MessageRole.ASSISTANT,
                            end_of_turn=end_of_turn,
                        )
                        await self.state.handle_message(message)
            except ConnectionClosedOK:
                pass
            except Exception as e:
                logger.error(f"Error processing Gemini response: {e}", exc_info=True)
                break

    async def handle_message(self, message: WebSocketMessage) -> None:
        """Handle messages from other components (no-op for reader)"""
        pass


class GeminiWriterTask(LongRunningTask, MessageSubscriber):
    """Writes messages to Gemini"""

    def __init__(
        self,
        state: ChatState,
        session: genai_live.AsyncSession,
    ):
        LongRunningTask.__init__(self, state)
        self.session = session
        state.add_subscriber(self)

    async def start(self):
        return []  # No background tasks needed

    async def handle_message(self, message: WebSocketMessage) -> None:
        """Forward appropriate messages to Gemini"""
        if message.role != MessageRole.USER:
            return

        if message.type == MessageType.INITIALIZE:
            await self.session.send(input=message.text, end_of_turn=True)
        elif isinstance(message, AudioWebSocketMessage):
            await self.session.send(
                input=genai_types.LiveClientRealtimeInput(
                    media_chunks=[
                        genai_types.Blob(
                            data=message.audio,
                            mime_type=message.mime_type,
                        )
                    ]
                )
            )
        elif isinstance(message, TextWebSocketMessage):
            await self.session.send(input=message.text or " ", end_of_turn=True)


class UserReaderTask(LongRunningTask, MessageSubscriber):
    """Reads from user websocket and publishes messages to state"""

    def __init__(
        self,
        websocket: TypedWebSocket,
        state: ChatState,
    ):
        LongRunningTask.__init__(self, state)
        self.websocket = websocket
        state.add_subscriber(self)

    async def start(self) -> list[asyncio.Task]:
        return [asyncio.create_task(self._process())]

    async def _process(self):
        while (
            self.running() and self.websocket.client_state == WebSocketState.CONNECTED
        ):
            try:
                message = await self.websocket.receive_message()
                await self.state.handle_message(message)
            except asyncio.CancelledError:
                break
            except WebSocketDisconnect:
                logger.info("Client disconnected")
                break
            except Exception as e:
                logger.error(f"Error processing client message: {e}", exc_info=True)
                break

    async def handle_message(self, message: WebSocketMessage) -> None:
        """Handle messages from other components (no-op for reader)"""
        pass


class UserWriterTask(LongRunningTask, MessageSubscriber):
    """Writes messages to user websocket"""

    def __init__(
        self,
        websocket: TypedWebSocket,
        state: ChatState,
    ):
        LongRunningTask.__init__(self, state)
        self.websocket = websocket
        state.add_subscriber(self)

    async def start(self):
        return []  # No background tasks needed

    async def handle_message(self, message: WebSocketMessage) -> None:
        """Forward appropriate messages to user"""
        if message.role == MessageRole.USER:
            return
        if message.type == MessageType.INITIALIZE:
            # don't forward the initialize message back
            return

        await self.websocket.send_message(message)


def wav_to_tensor(
    wav_file: genai_types.Blob, sampling_rate: int = 16000
) -> torch.Tensor:
    """Convert a WAV file to a PyTorch tensor"""
    assert wav_file.data
    wav, sr = torchaudio.load(io.BytesIO(wav_file.data), format="wav")

    if wav.size(0) > 1:
        wav = wav.mean(dim=0, keepdim=True)

    if sr != sampling_rate:
        transform = torchaudio.transforms.Resample(orig_freq=sr, new_freq=sampling_rate)
        wav = transform(wav)

    return wav.squeeze(0)


class TranscribeAndHintTask(LongRunningTask, MessageSubscriber):
    """Handles transcription and hints for user messages"""

    def __init__(
        self,
        state: ChatState,
        practice_language: Language,
        native_language: Language,
        client: genai.Client,
    ):
        LongRunningTask.__init__(self, state)
        self.practice_language = practice_language
        self.native_language = native_language
        self.client = client
        self.buffer = MessageBuffer(MessageRole.USER, CLIENT_SAMPLE_RATE)
        state.add_subscriber(self)

    async def start(self):
        return []  # No background tasks needed

    async def _get_history(self) -> tuple[str, str]:
        """Extract scenario and conversation history"""
        history_items = []
        scenario = ""
        for msg in self.state.history:
            if msg.type == MessageType.INITIALIZE:
                scenario = msg.text
            if msg.type == MessageType.TRANSCRIPTION:
                history_items.append(f"> {msg.role.value}: {msg.source_text}")
            elif msg.type == MessageType.TEXT:
                history_items.append(f"> {msg.role.value}: {msg.text}")
        return scenario, "\n".join(history_items)

    async def _generate_and_send_tts(self, text: str) -> None:
        """Generate TTS audio and send it as a message"""
        try:
            audio_response = await generate_tts_audio_async(text, self.practice_language)
            if audio_response:
                audio_msg = AudioWebSocketMessage(
                    audio=base64.b64encode(audio_response.data),
                    role=MessageRole.ASSISTANT,
                    end_of_turn=True,
                    mime_type="audio/mp3",
                )
                await self.state.handle_message(audio_msg)
        except Exception:
            logger.exception("Error generating audio")

    async def _process_turn(self, audio: bytes | None):
        """Process a complete turn from the user"""
        scenario, history = await self._get_history()

        try:
            response = await transcribe_and_hint(
                TranscribeAndHintRequest(
                    scenario=scenario,
                    history=history,
                    audio=audio,
                    mime_type=(
                        f"audio/pcm;rate={settings.CLIENT_SAMPLE_RATE}"
                        if audio
                        else None
                    ),
                    source_language=self.practice_language.abbreviation,
                    target_language=self.native_language.abbreviation,
                )
            )

            # TODO: if we had an audio sample, we need to add the users message
            # in text to the history
            await self.state.handle_message(
                TranscriptionWebSocketMessage(
                    role=MessageRole.USER,
                    source_text=response.transcription,
                    dictionary={},
                    chunked=[],
                    translated_text="",
                    end_of_turn=True,
                )
            )

            # Start TTS generation in background
            if self.state.modality == "audio":
                tts_task = asyncio.create_task(
                    self._generate_and_send_tts(response.response_text)
                )

            # Send transcription while TTS generates
            transcription = TranscriptionWebSocketMessage(
                role=MessageRole.ASSISTANT,
                source_text=response.response_text,
                dictionary=response.dictionary,
                chunked=response.chunked,
                translated_text=response.translated_text,
                end_of_turn=True,
            )
            await self.state.handle_message(transcription)

            hint = HintWebSocketMessage(
                role=MessageRole.ASSISTANT,
                hints=response.hints,
                end_of_turn=True,
            )
            await self.state.handle_message(hint)

            if self.state.modality == "audio":
                await tts_task

        except Exception as e:
            logger.exception("Error processing turn")
            msg = ErrorWebSocketMessage(
                text=f"Sorry, I ran into an error when responding: {e}",
                role=MessageRole.ASSISTANT,
            )
            await self.state.handle_message(msg)

    async def handle_message(self, message: WebSocketMessage) -> None:
        """Handle incoming messages"""
        # Skip messages we don't need to process
        if message.type in (MessageType.TRANSCRIPTION, MessageType.HINT):
            return
        if message.role == MessageRole.ASSISTANT:
            return

        # Handle initialization separately
        if message.type == MessageType.INITIALIZE:
            await self._process_turn(None)
            return

        if message.type == MessageType.AUDIO:
            self.buffer.add_audio(message.audio)

        # Check if we have a complete turn
        end_of_turn = message.end_of_turn

        # For audio, use VAD to detect speech boundaries
        # We need about a second of buffer at the end to reliably handle
        # the end of speech. We assume we have 1 channel at 16 bit PCM.
        SPEECH_BUFFER = 1.0 * 2 * CLIENT_SAMPLE_RATE
        if len(self.buffer.current_audio) > SPEECH_BUFFER:
            buffer_wav = convert_to_wav(
                genai_types.Blob(
                    data=self.buffer.current_audio,
                    mime_type=f"audio/pcm;rate={settings.CLIENT_SAMPLE_RATE}",
                )
            )
            buffer_tensor = wav_to_tensor(
                buffer_wav, sampling_rate=settings.CLIENT_SAMPLE_RATE
            )
            timestamps = get_speech_timestamps(
                buffer_tensor, vad_model, return_seconds=False
            )
            end_ts = [ts["end"] for ts in timestamps if ts["end"]]

            # we want to ignore the end if it's at the end of our buffer
            # this is currently a hack - we divide the buffer length by
            # 2 to get the sample count and compare
            if end_ts:
                last_ts = end_ts[-1]
                buffer_ts = len(self.buffer.current_audio) // 2
                if last_ts < buffer_ts - SPEECH_BUFFER:
                    logger.info("Hit - TS: %s, buffer %s", last_ts, buffer_ts)
                    end_of_turn = True

        # Process the turn if complete
        if end_of_turn:
            audio = self.buffer.end_turn()
            await self._process_turn(audio)
