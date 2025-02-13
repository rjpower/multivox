import asyncio
import base64
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Sequence

from fastapi import (
    FastAPI,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from google import genai
from google.genai import live as genai_live
from google.genai import types as genai_types

from multivox import scenarios
from multivox.cache import default_file_cache
from multivox.config import settings
from multivox.hints import generate_hints
from multivox.message_socket import TypedWebSocket
from multivox.scenarios import (
    get_chapter,
    get_scenario,
    list_chapters,
    list_scenarios,
)
from multivox.transcription import (
    create_audio_blob,
    extract_sample_rate,
    streaming_transcription_config,
    transcribe,
)
from multivox.translation import translate
from multivox.types import (
    CLIENT_SAMPLE_RATE,
    LANGUAGES,
    SERVER_SAMPLE_RATE,
    AudioWebSocketMessage,
    Chapter,
    ChatMessage,
    HintRequest,
    HintResponse,
    HintWebSocketMessage,
    Language,
    MessageRole,
    MessageType,
    PracticeRequest,
    Scenario,
    TextMode,
    TextWebSocketMessage,
    TranscribeRequest,
    TranscribeResponse,
    TranscriptionWebSocketMessage,
    TranslateRequest,
    TranslateResponse,
    WebSocketMessage,
)

ROOT_DIR = (
    Path(os.environ.get("ROOT_DIR"))
    if "ROOT_DIR" in os.environ
    else Path(__file__).resolve().parent.parent.parent
)

BATCH_API_KEY = os.environ.get("GEMINI_API_KEY")

file_cache = default_file_cache

logging.basicConfig(
    level=logging.INFO,
    format="%(filename)s:%(funcName)s:%(lineno)d:%(asctime)s:%(message)s",
)
logger = logging.getLogger(__name__)


app = FastAPI()


@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception):
    error_msg = str(exc)
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    logger.error(f"Unhandled error: {error_msg}")
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "https://multivox.rjp.io"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/translate")
async def api_translate(
    request: TranslateRequest,
    api_key: str = Query(..., description="Gemini API key"),
) -> TranslateResponse:
    if not api_key:
        raise HTTPException(status_code=401, detail="Gemini API key is required")
    return await translate(
        request.text,
        source_lang=(
            LANGUAGES[request.source_language] if request.source_language else None
        ),
        target_lang=LANGUAGES[request.target_language],
    )


@app.post("/api/hints")
async def api_generate_hints(request: HintRequest) -> HintResponse:
    """Generate possible responses to audio input"""
    return await generate_hints(request.history, language=LANGUAGES[request.language])


@app.post("/api/transcribe", response_model=TranscribeResponse)
async def api_transcribe_audio(request: TranscribeRequest) -> TranscribeResponse:
    client = genai.Client(api_key=request.api_key)
    audio_bytes = request.audio
    sample_rate = (
        request.sample_rate
        or extract_sample_rate(request.mime_type)
        or SERVER_SAMPLE_RATE
    )
    audio = genai_types.Blob(
        data=audio_bytes, mime_type=f"audio/pcm;rate={sample_rate}"
    )
    return await transcribe(
        client,
        audio,
        language=LANGUAGES[request.language] if request.language else None,
    )


@app.get("/api/languages")
def api_list_languages():
    """Get list of supported languages"""
    return [{"code": code, "name": lang.name} for code, lang in LANGUAGES.items()]


@app.get("/api/chapters")
def api_list_chapters() -> Sequence[Chapter]:
    """Get all chapters"""
    return list_chapters()


@app.get("/api/chapters/{chapter_id}")
def api_get_chapter(chapter_id: str) -> Chapter:
    """Get a specific chapter by ID"""
    try:
        return get_chapter(chapter_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Chapter not found")


@app.get("/api/scenarios")
def api_list_scenarios() -> Sequence[Scenario]:
    """Get all conversations (for backwards compatibility)"""
    return list_scenarios()


@app.get("/api/scenarios/{conversation_id}")
def api_get_scenario(conversation_id: str) -> Scenario:
    """Get a specific conversation by ID"""
    try:
        return get_scenario(conversation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Conversation not found")


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
    """Holds the conversation state and buffers"""

    def __init__(self):
        self.history: list[ChatMessage] = []
        self.buffers: dict[MessageRole, MessageBuffer] = {
            MessageRole.USER: MessageBuffer(MessageRole.USER, CLIENT_SAMPLE_RATE),
            MessageRole.ASSISTANT: MessageBuffer(
                MessageRole.ASSISTANT, SERVER_SAMPLE_RATE
            ),
        }
        self.transcript_queue: asyncio.Queue[tuple[MessageRole, bytes, str]] = (
            asyncio.Queue()
        )
        self.audio_queue: asyncio.Queue[bytes] = asyncio.Queue()

    def handle_message(self, message: WebSocketMessage):
        logger.info("Handling message: %s", message.type)
        if isinstance(message, TranscriptionWebSocketMessage):
            self.history.append(
                ChatMessage(
                    role=message.role, content=message.transcription.transcription
                )
            )
            return
        if isinstance(message, HintWebSocketMessage):
            return

        if isinstance(message, AudioWebSocketMessage):
            self.buffers[message.role].add_audio(message.audio)
        elif isinstance(message, TextWebSocketMessage):
            self.buffers[message.role].add_text(message.text, message.end_of_turn)

        if message.end_of_turn:
            audio, text = self.buffers[message.role].end_turn()
            self.history.append(ChatMessage(role=message.role, content=text))

            if message.role == MessageRole.ASSISTANT:
                self.transcript_queue.put_nowait((message.role, audio, text))

    def get_recent_messages(self) -> list[ChatMessage]:
        return self.history


class LongRunningTask:
    """Base class for long-running tasks that can be stopped"""

    def __init__(self, websocket: TypedWebSocket, state: "ChatState"):
        self.websocket = websocket
        self.state = state
        self._stop = False

    def running(self):
        return (not self._stop) and self.websocket.connected()

    def stop(self):
        self._stop = True

    async def start(self) -> list[asyncio.Task]:
        raise NotImplementedError()


class ClientReaderTask(LongRunningTask):
    """Handles reading from client websocket and forwarding to Gemini"""

    def __init__(
        self,
        websocket: TypedWebSocket,
        state: "ChatState",
        session: genai_live.AsyncSession,
    ):
        super().__init__(websocket, state)
        self.session = session

    async def start(self) -> list[asyncio.Task]:
        return [asyncio.create_task(self._process())]

    async def _process(self):
        # Handle first message (scenario initialization)
        message = await self.websocket.receive_message()
        assert message.type == MessageType.TEXT
        await self.session.send(input=message.text, end_of_turn=True)

        while self.running():
            try:
                message = await self.websocket.receive_message()
                if message.type == MessageType.AUDIO and message.audio:
                    logger.info("Forwarding audio message to Gemini")
                    # Add to audio queue for transcription
                    await self.state.audio_queue.put(message.audio)
                    # Send to Gemini
                    sample_rate = self.state.buffers[MessageRole.USER].sample_rate
                    await self.session.send(
                        input=genai_types.LiveClientRealtimeInput(
                            media_chunks=[
                                genai_types.Blob(
                                    data=message.audio,
                                    mime_type=f"audio/pcm;rate={sample_rate}",
                                )
                            ]
                        )
                    )
                elif message.type == MessageType.TEXT and message.text:
                    logger.info("Forwarding text message to Gemini: %s", message.text)
                    await self.session.send(input=message.text, end_of_turn=True)

            except asyncio.CancelledError:
                break  # exit loop upon cancellation
            except WebSocketDisconnect:
                logger.info("Client disconnected")
                pass
            except Exception as e:
                logger.error(f"Error processing client message: {e}", exc_info=True)
                break


class GeminiReaderTask(LongRunningTask):
    """Handles reading from Gemini and forwarding to client"""

    def __init__(
        self,
        websocket: TypedWebSocket,
        state: "ChatState",
        session: genai_live.AsyncSession,
    ):
        super().__init__(websocket, state)
        self.session = session

    async def start(self):
        return [asyncio.create_task(self._process())]

    async def _process(self):
        while self.running():
            try:
                async for response in self.session.receive():
                    if response.data:
                        logger.info(
                            "Received %d bytes of audio from Gemini", len(response.data)
                        )
                        message = AudioWebSocketMessage(
                            audio=base64.b64encode(response.data),
                            role=MessageRole.ASSISTANT,
                            end_of_turn=bool(
                                response.server_content
                                and response.server_content.turn_complete
                            ),
                        )
                    else:
                        logger.info("Received text from Gemini: %s", response.text)
                        message = TextWebSocketMessage(
                            text=response.text or "",
                            role=MessageRole.ASSISTANT,
                            mode=TextMode.APPEND,
                            end_of_turn=bool(
                                response.server_content
                                and response.server_content.turn_complete
                            ),
                        )
                    await self.websocket.send_message(message)

                    self.state.handle_message(message)
            except Exception as e:
                logger.error(f"Error processing Gemini response: {e}", exc_info=True)
                break


class BulkTranscriptionTask(LongRunningTask):
    """Handles transcription and hints using turn_queue"""
    def __init__(self, websocket: TypedWebSocket, state: ChatState, language: Language, client: genai.Client):
        super().__init__(websocket, state)
        self.language = language
        self.client = client

    async def start(self):
        return [asyncio.create_task(self._process())]

    async def _process(self):
        while self.running():
            try:
                logger.info("BulkTranscription: Waiting for turn")
                role, audio, text = await self.state.transcript_queue.get()
                logger.info(
                    "BulkTranscription: Processing turn, role=%s, audio=%s, text=%s",
                    role,
                    audio and len(audio),
                    text and len(text),
                )

                # we don't transcribe user messages
                if role == MessageRole.USER:
                    continue

                if audio:
                    # Process audio transcription
                    blob = genai_types.Blob(
                        data=audio,
                        mime_type=f"audio/pcm;rate={self.state.buffers[role].sample_rate}"
                    )
                    transcript = await transcribe(self.client, blob, self.language)
                    msg = TranscriptionWebSocketMessage(
                        transcription=transcript, role=role, end_of_turn=True
                    )
                elif text:
                    # process text via the translate function
                    translation = await translate(
                        text,
                        source_lang=self.language,
                        target_lang=self.language,
                    )
                    msg = TranscriptionWebSocketMessage(
                        transcription=TranscribeResponse(
                            transcription=translation.original,
                            translation=translation.translation,
                            chunked=translation.chunked,
                            dictionary=translation.dictionary,
                        ),
                        role=role,
                        end_of_turn=True,
                    )

                await self.websocket.send_message(msg)
                self.state.handle_message(msg)

                # Generate hints after assistant messages
                if role == MessageRole.ASSISTANT:
                    history_prompt = "\n".join(
                        f"> {msg.role}: {msg.content}" 
                        for msg in self.state.get_recent_messages()
                    )
                    logger.info("History: %s", history_prompt)
                    hints = await generate_hints(history_prompt, self.language)
                    msg = HintWebSocketMessage(
                        role=role, hints=hints.hints, end_of_turn=True
                    )
                    self.state.handle_message(msg)
                    await self.websocket.send_message(msg)
            except Exception as e:
                logger.error(f"Error processing turn: {e}", exc_info=True)


class StreamingTranscriptionTask(LongRunningTask):
    """Handles streaming transcription using audio_queue"""
    def __init__(self, websocket: TypedWebSocket, state: ChatState, language: Language, client: genai.Client):
        super().__init__(websocket, state)
        self.language = language
        self.client = client

    async def start(self) -> list[asyncio.Task]:
        config = streaming_transcription_config(self.language)
        self.ctx = self.client.aio.live.connect(
            model=settings.LIVE_MODEL_ID, config=config
        )
        self.session = await self.ctx.__aenter__()

        return [
            asyncio.create_task(self._send_audio()),
            asyncio.create_task(self._receive_responses())
        ]

    async def _send_audio(self):
        """Continuously read audio chunks from the feed and send to Gemini."""
        while self.running():
            chunk = await self.state.audio_queue.get()
            blob = create_audio_blob(
                chunk,
                self.state.buffers[MessageRole.USER].sample_rate
            )
            await self.session.send(
                genai_types.LiveClientRealtimeInput(media_chunks=[blob])
            )

    async def _receive_responses(self):
        """Continuously receive Gemini responses and process transcriptions."""
        async for response in self.session.receive():
            if response.text is None:
                continue
            try:
                result = TranscribeResponse.model_validate_json(response.text)
            except Exception:
                logger.warning("Failed to parse streaming transcription response: %s", response.text)
                continue

            # Add to chat history
            self.state.handle_message(
                ChatMessage(role=MessageRole.ASSISTANT, content=result.transcription)
            )

            # Send to client
            await self.websocket.send_message(
                TranscriptionWebSocketMessage(
                    transcription=result,
                    role=MessageRole.ASSISTANT,
                    end_of_turn=(
                        response.server_content.turn_complete 
                        if response.server_content 
                        else False
                    ),
                )
            )


class ChatContext:
    """Manages state for entire chat session including message history"""
    def __init__(
        self,
        websocket: TypedWebSocket,
        language: Language,
        api_key: str,
        modality: str = "audio",
        transcription_mode: str = "bulk"
    ):
        self.websocket = websocket
        self.language = language
        self.api_key = api_key
        self.modality = modality
        self.transcription_mode = transcription_mode
        self.state = ChatState()

        self.gemini_ctx = None
        self.gemini_session = None
        self.tasks: list[LongRunningTask] = []
        self.client = genai.Client(
            api_key=api_key,
            http_options={"api_version": settings.GEMINI_API_VERSION}
        )

    async def __aenter__(self):
        # Initialize Gemini session
        config = genai_types.LiveConnectConfig()
        config.response_modalities = [genai_types.Modality(self.modality)]
        config.speech_config = genai_types.SpeechConfig(
            voice_config=genai_types.VoiceConfig(
                prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        )
        config.system_instruction = genai_types.Content(
            parts=[
                genai_types.Part(
                    text=scenarios.SYSTEM_INSTRUCTIONS.format(
                        language=self.language.name,
                        today=datetime.now().strftime("%Y-%m-%d")
                    )
                )
            ]
        )

        self.gemini_ctx = self.client.aio.live.connect(
            model=settings.LIVE_MODEL_ID, config=config
        )

        self.gemini_session = await self.gemini_ctx.__aenter__()

        TranscriptionTaskClass = (
            StreamingTranscriptionTask
            if self.transcription_mode == "streaming"
            else BulkTranscriptionTask
        )
        self.tasks.extend(
            [
                ClientReaderTask(self.websocket, self.state, self.gemini_session),
                GeminiReaderTask(self.websocket, self.state, self.gemini_session),
                TranscriptionTaskClass(
                    self.websocket, self.state, self.language, self.client
                ),
            ]
        )

        # Start all tasks and collect their asyncio tasks
        self.aio_tasks = []
        for task in self.tasks:
            self.aio_tasks.extend(await task.start())
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.gemini_ctx:
            try:
                await asyncio.wait_for(
                    self.gemini_ctx.__aexit__(exc_type, exc_val, exc_tb),  # type: ignore
                    timeout=1,
                )
            except Exception:
                logger.warning("Timed out closing Gemini session")

        # Cancel and await all tasks
        for task in self.aio_tasks:
            task.cancel()
        await asyncio.gather(*self.aio_tasks, return_exceptions=True)

    async def run(self):
        done, pending = await asyncio.wait(
            self.aio_tasks,
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in done:
            logger.info(f"Task completed: {task}")


@app.websocket("/api/practice")
async def practice_session(
    raw_websocket: WebSocket,
    target_language: str = Query(..., description="Language code for practice session"),
    api_key: str = Query(..., description="Gemini API key."),
    modality: str = Query("audio", description="Response modality (audio/text)"),
    transcription_mode: str = Query("bulk", description="Transcription mode (bulk/streaming)"),
    test: bool = Query(False, description="Run in test mode"),
):
    request = PracticeRequest(
        target_language=target_language,
        modality=modality,
        test=test
    )
    if request.target_language not in LANGUAGES:
        await raw_websocket.close(
            code=1008, reason=f"Unsupported language: {request.target_language}"
        )
        return

    language = LANGUAGES[request.target_language]

    if not api_key:
        await raw_websocket.close(code=1008, reason="Missing Gemini API key")
        return

    websocket = TypedWebSocket(raw_websocket)

    try:
        await websocket.accept()
        logger.info(
            "Starting Gemini practice session: %s",
            language,
        )
        logger.info("Starting practice session with Gemini")

        async with ChatContext(
            websocket=websocket, language=language, api_key=api_key, modality=modality
        ) as ctx:
            await ctx.run()
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error in session: {e}", exc_info=True)
        await websocket.close(code=1011, reason="Internal server error")
    finally:
        await websocket.close(code=1000)


@app.get("/{full_path:path}")
def serve_index(full_path: str):
    if full_path.startswith("/api"):
        raise HTTPException(status_code=404, detail="File not found")

    dist_dir = Path(ROOT_DIR / "client" / "dist")
    path = (dist_dir / full_path).resolve()

    # ensure path is under dist_dir
    if not path.parts[: len(dist_dir.parts)] == dist_dir.parts:
        raise HTTPException(status_code=404, detail="File not found")

    if path.is_file():
        return FileResponse(path)
    elif not path.suffix:
        return FileResponse(dist_dir / "index.html")
    raise HTTPException(status_code=404, detail="File not found")
