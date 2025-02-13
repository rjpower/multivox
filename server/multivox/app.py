import asyncio
import base64
import logging
import os
from asyncio import Task
from datetime import datetime
from pathlib import Path
from typing import Optional, Sequence

import pydantic
import starlette.websockets
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
from pydantic import BaseModel
from websockets import ConnectionClosedOK

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
from multivox.transcription import extract_sample_rate, transcribe
from multivox.translation import translate
from multivox.types import (
    CLIENT_SAMPLE_RATE,
    LANGUAGES,
    SERVER_SAMPLE_RATE,
    AudioWebSocketMessage,
    Chapter,
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
    TranslateWebSocketMessage,
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


class AudioBuffer:
    """Manages audio for one speaker (client or server)"""

    def __init__(self, sample_rate: int, role: MessageRole):
        self.sample_rate = sample_rate
        self.current_turn: bytes = b""
        self.role = role

    def add_audio(self, audio: bytes):
        self.current_turn += audio

    def end_turn(self) -> bytes:
        """Returns the current turn's audio and starts a new turn"""
        audio = self.current_turn
        self.current_turn = b""
        return audio


class TranscriptionTask(BaseModel):
    """Represents a pending audio transcription"""
    model_config = pydantic.ConfigDict(arbitrary_types_allowed=True)
    payload: bytes
    sample_rate: int
    role: MessageRole
    language: Language
    websocket: TypedWebSocket
    ctx: "ChatContext"

    def model_post_init(self, ctx):
        assert isinstance(self.language, Language)

    async def run(self):
        try:
            logger.info(
                "Processing transcription task: role=%s, sample_rate=%s, language=%s",
                self.role,
                self.sample_rate,
                self.language,
            )

            blob = genai_types.Blob(
                data=self.payload,
                mime_type=f"audio/pcm;rate={self.sample_rate}",
            )
            result = await transcribe(self.ctx.client, blob, language=self.language)

            # Add message to history
            self.ctx.chat_history.append(
                ChatMessage(role=self.role, content=result.transcription)
            )

            # Generate hints for transcribed text and send to client
            if self.role == MessageRole.ASSISTANT:
                self.ctx.create_hint_task(result.transcription)
                await self.websocket.send_message(
                    TranscriptionWebSocketMessage(
                        transcription=result,
                        role=self.role,
                        end_of_turn=True,
                    )
                )
        except Exception as e:
            logger.error(f"Transcription failed: {e}", exc_info=True)
            await self.websocket.send_message(
                TextWebSocketMessage(
                    text="Sorry, there was a server error processing the audio.",
                    role=MessageRole.ASSISTANT,
                    mode=TextMode.APPEND,
                    end_of_turn=True,
                )
            )


class TranslateTask(BaseModel):
    """Represents a pending text translation"""
    model_config = pydantic.ConfigDict(arbitrary_types_allowed=True)
    text: str
    role: MessageRole
    source_language: Language
    websocket: TypedWebSocket
    ctx: "ChatContext"

    async def run(self):
        try:
            logger.info(
                "Processing translation task: role=%s, language=%s",
                self.role,
                self.source_language,
            )

            result = await translate(
                self.text,
                source_lang=self.source_language,
                target_lang=LANGUAGES["en"],
            )
            await self.websocket.send_message(
                TranslateWebSocketMessage(
                    role=self.role,
                    original=self.text,
                    translation=result.translation,
                    chunked=result.chunked,
                    dictionary=result.dictionary,
                    end_of_turn=True,
                )
            )
        except Exception as e:
            logger.error(f"Translation failed: {e}", exc_info=True)
            await self.websocket.send_message(
                TextWebSocketMessage(
                    text="Sorry, there was a server error processing the translation.",
                    role=MessageRole.ASSISTANT,
                    mode=TextMode.APPEND,
                    end_of_turn=True,
                )
            )


class ChatMessage(BaseModel):
    """Represents a single chat message"""

    role: MessageRole
    content: str


class HintTask(BaseModel):
    """Generates hints based on the last assistant message"""
    model_config = pydantic.ConfigDict(arbitrary_types_allowed=True)
    history: list[ChatMessage]
    language: Language
    websocket: TypedWebSocket
    ctx: "ChatContext"

    async def run(self):
        try:
            logger.info(
                "Processing hint task for message: %s",
                self.history[-1],
            )

            history_prompt = "\n".join(
                [f"> {msg.role.value}: {msg.content}" for msg in self.history]
            )

            result = await generate_hints(
                history_prompt,
                language=self.language,
            )
            await self.websocket.send_message(
                HintWebSocketMessage(
                    role=MessageRole.ASSISTANT,
                    hints=result.hints,
                    end_of_turn=True
                )
            )
        except Exception as e:
            logger.error(f"Hint generation failed: {e}", exc_info=True)
            await self.websocket.send_message(
                TextWebSocketMessage(
                    text="Sorry, there was a server error generating suggestions.",
                    role=MessageRole.ASSISTANT,
                    end_of_turn=True,
                    mode=TextMode.APPEND,
                )
            )


class ChatContext:
    """Manages state for entire chat session including message history"""

    def __init__(
        self, websocket: TypedWebSocket, language: Language, client: genai.Client
    ):
        self.websocket = websocket
        self.language = language
        self.client = client
        assert isinstance(self.language, Language)
        self.buffers = {
            MessageRole.USER: AudioBuffer(CLIENT_SAMPLE_RATE, MessageRole.USER),
            MessageRole.ASSISTANT: AudioBuffer(SERVER_SAMPLE_RATE, MessageRole.ASSISTANT),
        }
        self.chat_history: list[ChatMessage] = []
        self.tasks: list[Task] = []
        self.pending_text: dict[MessageRole, str] = {
            MessageRole.USER: "",
            MessageRole.ASSISTANT: "",
        }

    def handle_end_of_turn(self, role: MessageRole):
        """Process any pending content when a turn ends"""
        # Handle any pending audio
        buffer = self.buffers[role]
        audio = buffer.end_turn()
        if audio:
            self.create_transcription_task(audio, role)

        # Handle any pending text
        if self.pending_text[role]:
            text = self.pending_text[role]
            self.pending_text[role] = ""
            if role == MessageRole.ASSISTANT:
                # For text messages, create hint and translation tasks
                self.create_hint_task(text)
                self.create_translation_task(text, role)

    def create_transcription_task(self, audio: bytes, role: MessageRole):
        """Create and schedule a transcription task"""
        transcription = TranscriptionTask(
            payload=audio,
            sample_rate=self.buffers[role].sample_rate,
            role=role,
            language=self.language,
            websocket=self.websocket,
            ctx=self,
        )
        task = asyncio.create_task(transcription.run())
        task.add_done_callback(self.handle_task_done)
        self.tasks.append(task)
        logger.info("Created transcription task")

    def create_translation_task(self, text: str, role: MessageRole):
        """Create and schedule a translation task"""
        if not text.strip():
            return

        translation = TranslateTask(
            text=text,
            role=role,
            source_language=self.language,
            websocket=self.websocket,
            ctx=self,
        )
        task = asyncio.create_task(translation.run())
        task.add_done_callback(self.handle_task_done)
        self.tasks.append(task)
        logger.info("Created translation task")

    def create_hint_task(self, text: str):
        """Create hint task for the given text"""
        if not text.strip():
            return

        hint_task = HintTask(
            history=self.chat_history,
            language=self.language,
            websocket=self.websocket,
            ctx=self,
        )
        task = asyncio.create_task(hint_task.run())
        task.add_done_callback(self.handle_task_done)
        self.tasks.append(task)
        logger.info("Created hint task")

    async def handle_message(self, message: WebSocketMessage):
        """Process incoming message from either client or server"""
        if message.type == MessageType.AUDIO:
            self.buffers[message.role].add_audio(message.audio)

        elif message.type == MessageType.TEXT:
            self.pending_text[message.role] += message.text
            self.chat_history.append(
                ChatMessage(role=message.role, content=message.text)
            )

        # when handling user audio, we don't have an obvious end of turn indicator.
        # instead, if we get output from the assistant, we assume the user's turn is over.
        if message.end_of_turn:
            logger.info("End of turn.")
            if message.role == MessageRole.ASSISTANT:
                self.handle_end_of_turn(MessageRole.USER)
            self.handle_end_of_turn(message.role)

        # Forward assistant messages to client
        if message.role == MessageRole.ASSISTANT:
            await self.websocket.send_message(message)

    def handle_task_done(self, task: Task):
        try:
            task.result()
            logger.info("Task completed successfully")
        except Exception as e:
            logger.error(f"Task failed: {e}", exc_info=True)
        finally:
            if task in self.tasks:
                self.tasks.remove(task)


async def read_from_client(
    websocket: TypedWebSocket, session: genai_live.AsyncSession, context: ChatContext
) -> None:
    """Handle the input stream from the client to Gemini"""

    # the first message is special: it's the scenario initialization.
    # we act as the assistant, but we don't want to transcribe/hint/etc.
    message = await websocket.receive_message()
    assert message.type == MessageType.TEXT
    await session.send(input=message.text, end_of_turn=True)

    while websocket.connected():
        try:
            message = await websocket.receive_message()
            await context.handle_message(message)
            if message.type == MessageType.AUDIO and message.audio:
                await session.send(input=genai_types.LiveClientRealtimeInput(
                    media_chunks=[genai_types.Blob(
                        data=message.audio,
                        mime_type=f"audio/pcm;rate={CLIENT_SAMPLE_RATE}"
                    )]
                ))
            elif message.type == MessageType.TEXT and message.text:
                await session.send(input=message.text, end_of_turn=True)
        except starlette.websockets.WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error(f"Error in input stream: {e}", exc_info=True)
            return


async def read_from_gemini(
    websocket: TypedWebSocket, session: genai_live.AsyncSession, context: ChatContext
) -> None:
    """Handle the output stream from Gemini to the client"""
    while websocket.connected():
        try:
            async for response in session.receive():
                # Create message from Gemini response
                if response.data:
                    message = AudioWebSocketMessage(
                        audio=base64.b64encode(response.data),
                        role=MessageRole.ASSISTANT,
                        end_of_turn=bool(
                            response.server_content
                            and response.server_content.turn_complete
                        ),
                    )
                else:
                    message = TextWebSocketMessage(
                        text=response.text or "",
                        role=MessageRole.ASSISTANT,
                        mode=TextMode.APPEND,
                        end_of_turn=bool(
                            response.server_content
                            and response.server_content.turn_complete
                        ),
                    )
                await context.handle_message(message)
        except ConnectionClosedOK:
            pass
        except Exception as e:
            logger.error(f"Error in output stream: {e}", exc_info=True)
            break


async def handle_gemini_session(websocket: TypedWebSocket, language: Language, modality: str, api_key: str) -> None:
    """Handle the async Gemini session interaction using separate tasks for input/output"""
    logger.info("Connecting to Gemini!")

    input_task: Optional[Task] = None
    output_task: Optional[Task] = None

    # Create a new client with the provided API key
    # The live API requires v1alpha, but this runs into 429 errors quickly
    # so we use the default version for translation & hints
    live_client = genai.Client(api_key=api_key, http_options={"api_version": settings.GEMINI_API_VERSION})

    context = ChatContext(websocket, language=language, client=live_client)
    config = genai_types.LiveConnectConfig()
    config.response_modalities = [genai_types.Modality(modality)]
    config.speech_config = genai_types.SpeechConfig(
        voice_config=genai_types.VoiceConfig(
            prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(voice_name="Aoede")
        )
    )
    config.system_instruction = genai_types.Content(
        parts=[
            genai_types.Part(
                text=scenarios.SYSTEM_INSTRUCTIONS.format(
                    language=language.name, today=datetime.now().strftime("%Y-%m-%d")
                )
            )
        ]
    )

    # Use the context manager manually so we can wrap __aenter__ and __aexit__
    # The live API can hang on close and doesn't expose a timeout.
    session_cm = live_client.aio.live.connect(model=settings.LIVE_MODEL_ID, config=config)
    try:
        session = await asyncio.wait_for(session_cm.__aenter__(), timeout=5)
    except asyncio.TimeoutError:
        logger.error("Timed out connecting to Gemini")
        return

    try:
        input_task = asyncio.create_task(read_from_client(websocket, session, context))
        output_task = asyncio.create_task(read_from_gemini(websocket, session, context))

        done, _ = await asyncio.wait(
            [input_task, output_task], return_when=asyncio.FIRST_COMPLETED
        )

        # log which task completed
        for task in done:
            if task == input_task:
                logger.info("Input task completed")
            elif task == output_task:
                logger.info("Output task completed")
    finally:
        try:
            await asyncio.wait_for(session_cm.__aexit__(None, None, None), timeout=1)
        except asyncio.TimeoutError:
            logger.warning("Timed out waiting for Gemini session to close")

        pending = [
            task
            for task in [input_task, output_task] + context.tasks
            if task and not task.done()
        ]
        for task in pending:
            logger.info("Cancelling task: %s", task)
            task.cancel()

        await asyncio.wait_for(
            asyncio.gather(*pending, return_exceptions=True), timeout=1
        )


@app.websocket("/api/practice")
async def practice_session(
    raw_websocket: WebSocket,
    target_language: str = Query(..., description="Language code for practice session"),
    api_key: str = Query(..., description="Gemini API key."),
    modality: str = Query("audio", description="Response modality (audio/text)"),
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

    websocket = TypedWebSocket(raw_websocket)
    if not api_key:
        await websocket.close(code=1008, reason="Missing Gemini API key")
        return

    language = LANGUAGES[request.target_language]

    try:
        await websocket.accept()
        logger.info(
            "Starting Gemini practice session: %s",
            language,
        )
        await handle_gemini_session(
            websocket, language=language, modality=request.modality, api_key=api_key
        )
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
