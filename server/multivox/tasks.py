import asyncio
import base64
import logging

from fastapi import WebSocketDisconnect
from fastapi.websockets import WebSocketState
from google import genai
from google.genai import live as genai_live
from google.genai import types as genai_types
from websockets import ConnectionClosedOK

from multivox.config import settings
from multivox.hints import generate_hints
from multivox.message_socket import TypedWebSocket
from multivox.transcription import (
    transcribe,
)
from multivox.translation import translate
from multivox.types import (
    CLIENT_SAMPLE_RATE,
    SERVER_SAMPLE_RATE,
    AudioWebSocketMessage,
    ErrorWebSocketMessage,
    HintWebSocketMessage,
    Language,
    MessageRole,
    MessageType,
    TextWebSocketMessage,
    TranscriptionWebSocketMessage,
    WebSocketMessage,
)

logger = logging.getLogger(__name__)


class MessageBuffer:
    """Manages both text and audio content for a speaker"""

    def __init__(self, role: MessageRole, sample_rate: int | None = None):
        self.role = role
        self.sample_rate = sample_rate
        self.current_audio: bytes = b""
        self.current_text: str = ""
        self.turn_complete = False

    def add_audio(self, audio: bytes):
        self.current_audio += audio

    def add_text(self, text: str, end_of_turn: bool = False):
        self.current_text += text
        self.turn_complete = end_of_turn

    def end_turn(self) -> tuple[bytes, str]:
        audio = self.current_audio
        text = self.current_text
        self.current_audio = b""
        self.current_text = ""
        self.turn_complete = False
        return audio, text


class ChatState:
    """Holds the conversation state."""

    def __init__(self, session: genai_live.AsyncSession, user_ws: TypedWebSocket):
        self.history: list[WebSocketMessage] = []
        self.message_queue: asyncio.Queue[WebSocketMessage] = asyncio.Queue()
        self.gemini = session
        self.user_ws = user_ws

    async def handle_message(self, message: WebSocketMessage) -> None:
        logger.info(
            "Handling message: %s, %s, end: %s",
            message.type,
            message.role,
            message.end_of_turn,
        )
        self.history.append(message)
        self.message_queue.put_nowait(message)

        if message.type == MessageType.INITIALIZE:
            await self.gemini.send(input=message.text, end_of_turn=True)
            return

        if isinstance(message, TranscriptionWebSocketMessage):
            await self.user_ws.send_message(message)
            return

        if isinstance(message, HintWebSocketMessage):
            await self.user_ws.send_message(message)
            return

        if isinstance(message, ErrorWebSocketMessage):
            await self.user_ws.send_message(message)
            return

        if isinstance(message, AudioWebSocketMessage):
            if message.role == MessageRole.USER:
                # forward to the Gemini session
                await self.gemini.send(
                    input=genai_types.LiveClientRealtimeInput(
                        media_chunks=[
                            genai_types.Blob(
                                data=message.audio,
                                mime_type=f"audio/pcm;rate={settings.SERVER_SAMPLE_RATE}",
                            )
                        ]
                    )
                )
            else:
                # forward to the user
                await self.user_ws.send_message(message)

        if isinstance(message, TextWebSocketMessage):
            if message.role == MessageRole.USER:
                await self.gemini.send(input=message.text or " ", end_of_turn=True)
            else:
                await self.user_ws.send_message(message)


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


class BulkTranscriptionTask(LongRunningTask):
    """Handles transcription and hints using turn_queue"""

    def __init__(
        self,
        state: ChatState,
        practice_language: Language,
        native_language: Language,
        client: genai.Client,
    ):
        super().__init__(state)
        self.practice_language = practice_language
        self.native_language = native_language
        self.client = client
        self.buffers: dict[MessageRole, MessageBuffer] = {
            MessageRole.USER: MessageBuffer(MessageRole.USER, CLIENT_SAMPLE_RATE),
            MessageRole.ASSISTANT: MessageBuffer(
                MessageRole.ASSISTANT, SERVER_SAMPLE_RATE
            ),
        }

    async def start(self):
        return [asyncio.create_task(self._process())]

    async def _fetch_transcript(self, audio, role):
        transcript = await transcribe(
            audio_data=audio,
            mime_type=f"audio/pcm;rate={settings.SERVER_SAMPLE_RATE}",
            source_language=self.practice_language,
            target_language=self.native_language,
        )

        msg = TranscriptionWebSocketMessage(
            source_text=transcript.source_text,
            translated_text=transcript.translated_text,
            chunked=transcript.chunked,
            dictionary=transcript.dictionary,
            role=role,
            end_of_turn=True,
        )
        return msg

    async def _fetch_translation(self, text, role):
        translation = await translate(
            text,
            source_language=self.practice_language,
            target_language=self.native_language,
        )
        msg = TranscriptionWebSocketMessage(
            source_text=translation.source_text,
            translated_text=translation.translated_text,
            chunked=translation.chunked,
            dictionary=translation.dictionary,
            role=role,
            end_of_turn=True,
        )
        return msg

    async def _fetch_hint(self):
        history_items = []
        scenario = ""
        for msg in self.state.history:
            if msg.type == MessageType.INITIALIZE:
                scenario = msg.text
            if msg.type == MessageType.TRANSCRIPTION:
                history_items.append(f"> {msg.role}: {msg.source_text}")
            elif msg.type == MessageType.TEXT:
                history_items.append(f"> {msg.role}: {msg.text}")

        history_prompt = "\n".join(history_items)
        hints = await generate_hints(
            history_prompt,
            scenario=scenario,
            source_language=self.practice_language,
            target_language=self.native_language,
        )
        msg = HintWebSocketMessage(
            role=MessageRole.ASSISTANT, hints=hints.hints, end_of_turn=True
        )
        return msg

    async def _process(self):
        while self.running():
            message = await self.state.message_queue.get()
            if message.type in (
                MessageType.INITIALIZE,
                MessageType.TRANSCRIPTION,
                MessageType.HINT,
            ):
                continue

            if message.type == MessageType.AUDIO:
                self.buffers[message.role].add_audio(message.audio)
            if message.type == MessageType.TEXT:
                self.buffers[message.role].add_text(message.text, message.end_of_turn)

            audio = text = None
            role = message.role
            if message.end_of_turn:
                audio, text = self.buffers[message.role].end_turn()

            logger.info(
                "transcription: Processing turn, role=%s, audio=%s, text=%s",
                role,
                audio and len(audio),
                text and len(text),
            )

            if not text and not audio:
                continue
            
            # We aren't transcribing the user's audio at the moment.
            if role != MessageRole.ASSISTANT:
                continue

            try:
                if audio:
                    msg = await self._fetch_transcript(audio, role)
                elif text:
                    msg = await self._fetch_translation(text, role)
            except Exception as e:
                logger.exception("Error transcribing/translating audio")
                msg = ErrorWebSocketMessage(
                    text=f"Sorry, I couldn't transcribe that audio: {e}",
                    role=role,
                )
            await self.state.handle_message(msg)

            if msg.role == MessageRole.ASSISTANT:
                try:
                    msg = await self._fetch_hint()
                except Exception as e:
                    logger.exception("Error generating hints")
                    msg = ErrorWebSocketMessage(
                        role=MessageRole.ASSISTANT,
                        text=f"Sorry, I couldn't generate hints. Error was {e}",
                    )

                await self.state.handle_message(msg)


class GeminiReaderTask(LongRunningTask):
    """Handles reading from Gemini and forwarding to client"""

    def __init__(
        self,
        state: ChatState,
        session: genai_live.AsyncSession,
    ):
        super().__init__(state)
        self.session = session

    async def start(self):
        return [asyncio.create_task(self._process())]

    async def _process(self):
        while self.running():
            try:
                async for response in self.session.receive():
                    end_of_turn = bool(response.server_content and response.server_content.turn_complete)
                    if response.data:
                        logger.debug(
                            "Received %d bytes of audio from Gemini", len(response.data)
                        )
                        message = AudioWebSocketMessage(
                            audio=base64.b64encode(response.data),
                            role=MessageRole.ASSISTANT,
                            end_of_turn=end_of_turn,
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


class ClientReaderTask(LongRunningTask):
    """Handles reading from client websocket and forwarding to Gemini"""

    def __init__(
        self,
        websocket: TypedWebSocket,
        state: ChatState,
        session: genai_live.AsyncSession,
    ):
        super().__init__(state)
        self.websocket = websocket
        self.session = session

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
                break  # exit loop upon cancellation
            except WebSocketDisconnect:
                logger.info("Client disconnected")
                pass
            except Exception as e:
                logger.error(f"Error processing client message: {e}", exc_info=True)
                break
