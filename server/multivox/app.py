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
    staticfiles,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.websockets import WebSocketState
from google import genai
from google.genai import live as genai_live
from google.genai import types as genai_types
from websockets import ConnectionClosedOK

from multivox import scenarios
from multivox.cache import default_file_cache
from multivox.config import settings
from multivox.flashcards.api import router as flashcard_router
from multivox.hints import STREAMING_HINT_PROMPT, generate_hints
from multivox.message_socket import TypedWebSocket
from multivox.scenarios import (
    get_chapter,
    get_scenario,
    list_chapters,
    list_scenarios,
)
from multivox.transcription import (
    STREAMING_TRANSCRIPTION_INITIAL_PROMPT,
    STREAMING_TRANSCRIPTION_PROMPT,
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
    ErrorWebSocketMessage,
    HintResponse,
    HintWebSocketMessage,
    Language,
    MessageRole,
    MessageType,
    PracticeRequest,
    Scenario,
    TextWebSocketMessage,
    TranscribeRequest,
    TranscribeResponse,
    TranscriptionWebSocketMessage,
    TranslateRequest,
    TranslateResponse,
    WebSocketMessage,
)

BATCH_API_KEY = os.environ.get("GEMINI_API_KEY")

file_cache = default_file_cache

logging.basicConfig(
    level=logging.INFO,
    format="%(filename)s:%(funcName)s:%(lineno)d:%(asctime)s:%(message)s",
)
logger = logging.getLogger(__name__)


app = FastAPI()

app.include_router(flashcard_router)
app.mount(
    "/downloads",
    staticfiles.StaticFiles(directory=settings.DOWNLOAD_DIR, check_dir=False),
    name="downloads",
)


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

        # forward transcriptions and hints to the user.
        if isinstance(message, TranscriptionWebSocketMessage):
            # for now, we aren't forwarding transcriptions to the user
            if message.role == MessageRole.ASSISTANT:
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
                await self.gemini.send(input=message.text, end_of_turn=True)
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
                    if response.data:
                        logger.debug(
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
                        await self.state.handle_message(message)
                    else:
                        logger.debug("Received text from Gemini: %s", response.text)
                        message = TextWebSocketMessage(
                            text=response.text or "",
                            role=MessageRole.ASSISTANT,
                            end_of_turn=bool(
                                response.server_content
                                and response.server_content.turn_complete
                            ),
                        )
                        await self.state.handle_message(message)
            except ConnectionClosedOK:
                pass
            except Exception as e:
                logger.error(f"Error processing Gemini response: {e}", exc_info=True)
                break


class BulkTranscriptionTask(LongRunningTask):
    """Handles transcription and hints using turn_queue"""

    def __init__(self, state: ChatState, language: Language, client: genai.Client):
        super().__init__(state)
        self.language = language
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
            source_language=self.language,
        )
        msg = TranscriptionWebSocketMessage(
            transcription=transcript,
            role=role,
            end_of_turn=True,
        )
        return msg

    async def _fetch_translation(self, text, role):
        translation = await translate(
            text,
            source_language=self.language,
            target_language=self.language,
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
        return msg

    async def _fetch_hint(self):
        history_items = []
        for msg in self.state.history:
            if msg.type == MessageType.TRANSCRIPTION:
                history_items.append(f"> {msg.role}: {msg.transcription.transcription}")
            elif msg.type == MessageType.TEXT:
                history_items.append(f"> {msg.role}: {msg.text}")

        history_prompt = "\n".join(history_items)
        hints = await generate_hints(history_prompt, self.language)
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

            logger.debug(
                "BulkTranscription: Processing turn, role=%s, audio=%s, text=%s",
                role,
                audio and len(audio),
                text and len(text),
            )

            if not text and not audio:
                continue

            try:
                if audio:
                    msg = await self._fetch_transcript(audio, role)
                elif text:
                    msg = await self._fetch_translation(text, role)
            except Exception as e:
                msg = ErrorWebSocketMessage(
                    text=f"Sorry, I couldn't transcribe that audio: {e}",
                    role=role,
                )
            await self.state.handle_message(msg)

            if msg.role == MessageRole.ASSISTANT:
                msg = await self._fetch_hint()
                await self.state.handle_message(msg)


class StreamingTranscriptionTask(LongRunningTask):
    """Handles streaming transcription using message_queue"""

    session: genai_live.AsyncSession

    def __init__(self, state: ChatState, language: Language, client: genai.Client):
        super().__init__(state)
        self.language = language
        self.client = client

    async def start(self) -> list[asyncio.Task]:
        config = streaming_transcription_config(self.language)
        self.ctx = self.client.aio.live.connect(
            model=settings.LIVE_MODEL_ID, config=config
        )
        self.session = await self.ctx.__aenter__()
        return [asyncio.create_task(self._process())]

    async def _fetch_transcript(self, role: MessageRole):
        logger.info("Requesting transcript")
        await self.session.send(input=STREAMING_TRANSCRIPTION_PROMPT, end_of_turn=True)
        # accumulate text, try to parse
        async for r in self.session.receive():
            logger.info("Received transcript response %s", r)
            if r.tool_call and r.tool_call.function_calls:
                for call in r.tool_call.function_calls:
                    response = TranscribeResponse.model_validate(call.args)
                    msg = TranscriptionWebSocketMessage(
                        role=role,
                        transcription=response,
                        end_of_turn=True,
                    )
                    await self.session.send(
                        input=genai_types.FunctionResponse(
                            id=call.id, response={"status": "ok"}
                        )
                    )
                    await self.state.handle_message(msg)

    async def _fetch_hint(self):
        logger.info("Requesting hint")
        await self.session.send(input=STREAMING_HINT_PROMPT, end_of_turn=True)
        async for r in self.session.receive():
            logger.info("Received hint response %s", r)
            if r.tool_call and r.tool_call.function_calls:
                for call in r.tool_call.function_calls:
                    response = HintResponse.model_validate(call.args)
                    msg = HintWebSocketMessage(
                        role=MessageRole.ASSISTANT,
                        hints=response.hints,
                        end_of_turn=True,
                    )
                    await self.session.send(
                        input=genai_types.FunctionResponse(
                            id=call.id, response={"status": "ok"}
                        )
                    )
                    await self.state.handle_message(msg)

    async def _process(self):
        """Process messages from queue and handle transcription/hints"""
        await self.session.send(input=STREAMING_TRANSCRIPTION_INITIAL_PROMPT)
        while self.running():
            try:
                message = await self.state.message_queue.get()
                logger.info("Streaming: %s %s", message.role, message.type)
                if message.type in (
                    MessageType.INITIALIZE,
                    MessageType.TRANSCRIPTION,
                    MessageType.HINT,
                ):
                    continue

                if message.type == MessageType.TEXT:
                    await self.session.send(
                        input=f"<role={message.role}>message.text</role>"
                    )

                if message.end_of_turn and message.role == MessageRole.ASSISTANT:
                    logger.info("End of turn: %s %s", message.role, message.type)
                    await self._fetch_transcript(message.role)
                    await self._fetch_hint()
            except Exception as e:
                logger.error(f"Error streaming transcripts: {e}", exc_info=True)


class ChatContext:
    """Manages state for entire chat session including message history"""

    def __init__(
        self,
        websocket: TypedWebSocket,
        language: Language,
        api_key: str,
        modality: str = "audio",
        transcription_mode: str = "bulk",
    ):
        self.websocket = websocket
        self.language = language
        self.api_key = api_key
        self.modality = modality
        self.transcription_mode = transcription_mode

        self.gemini_ctx = None
        self.gemini_session = None
        self.tasks: list[LongRunningTask] = []
        self.client = genai.Client(
            api_key=api_key, http_options={"api_version": settings.GEMINI_API_VERSION}
        )

    async def __aenter__(self):
        config = genai_types.LiveConnectConfig()
        config.response_modalities = [genai_types.Modality(self.modality)]
        config.speech_config = genai_types.SpeechConfig(
            voice_config=genai_types.VoiceConfig(
                prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(
                    voice_name="Aoede"
                )
            )
        )
        config.system_instruction = genai_types.Content(
            parts=[
                genai_types.Part(
                    text=scenarios.SYSTEM_INSTRUCTIONS.format(
                        language=self.language.name,
                        today=datetime.now().strftime("%Y-%m-%d"),
                    )
                )
            ]
        )

        self.gemini_ctx = self.client.aio.live.connect(
            model=settings.LIVE_MODEL_ID, config=config
        )
        self.gemini_session = await self.gemini_ctx.__aenter__()
        self.state = ChatState(self.gemini_session, self.websocket)

        TranscriptionTaskClass = (
            StreamingTranscriptionTask
            if self.transcription_mode == "streaming"
            else BulkTranscriptionTask
        )
        self.tasks.extend(
            [
                ClientReaderTask(self.websocket, self.state, self.gemini_session),
                GeminiReaderTask(self.state, self.gemini_session),
                TranscriptionTaskClass(self.state, self.language, self.client),
            ]
        )

        # Start all tasks and collect their asyncio tasks
        self.aio_tasks = []
        for task in self.tasks:
            self.aio_tasks.extend(await task.start())
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        for task in self.tasks:
            task.stop()

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
    transcription_mode: str = Query(
        "streaming", description="Transcription mode (bulk/streaming)"
    ),
    test: bool = Query(False, description="Run in test mode"),
):
    request = PracticeRequest(
        target_language=target_language, modality=modality, test=test
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


@app.post("/api/translate")
async def api_translate(request: TranslateRequest) -> TranslateResponse:
    return await translate(
        request.text,
        source_language=(
            LANGUAGES[request.source_language] if request.source_language else None
        ),
        target_language=LANGUAGES[request.target_language],
        api_key=request.api_key if request.api_key else None,
        model_id=settings.GEMINI_MODEL_ID,
    )


@app.post("/api/transcribe", response_model=TranscribeResponse)
async def api_transcribe(request: TranscribeRequest) -> TranscribeResponse:
    return await transcribe(
        audio_data=request.audio,
        mime_type=request.mime_type,
        api_key=request.api_key,
        source_language=LANGUAGES[request.language] if request.language else None,
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


@app.get("/{full_path:path}")
def serve_index(full_path: str):
    """Render static files or the client-side app as a fall-through for all other routes."""
    if full_path.startswith("/api"):
        raise HTTPException(status_code=404, detail="File not found")

    dist_dir = Path(settings.ROOT_DIR / "client" / "dist")
    path = (dist_dir / full_path).resolve()

    # ensure path is under dist_dir
    if not path.parts[: len(dist_dir.parts)] == dist_dir.parts:
        raise HTTPException(status_code=404, detail="File not found")

    if path.is_file():
        return FileResponse(path)
    elif not path.suffix:
        return FileResponse(dist_dir / "index.html")
    raise HTTPException(status_code=404, detail="File not found")
