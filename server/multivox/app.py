import asyncio
import enum
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Sequence

import pydantic
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
from google import genai
from google.genai import live as genai_live
from google.genai import types as genai_types

from multivox import prompts
from multivox.cache import default_file_cache
from multivox.config import settings
from multivox.flashcards.api import router as flashcard_router
from multivox.journal import router as journal_router
from multivox.message_socket import TypedWebSocket
from multivox.scenarios import (
    get_scenario,
    list_scenarios,
)
from multivox.tasks import (
    BulkTranscriptionTask,
    ChatState,
    GeminiReaderTask,
    GeminiWriterTask,
    LongRunningTask,
    TranscribeAndHintTask,
    UserReaderTask,
    UserWriterTask,
)
from multivox.transcribe import (
    transcribe,
)
from multivox.translate import translate
from multivox.types import (
    LANGUAGES,
    Language,
    Scenario,
    TranscribeRequest,
    TranscribeResponse,
    TranslateRequest,
    TranslateResponse,
)

BATCH_API_KEY = os.environ.get("GEMINI_API_KEY")

file_cache = default_file_cache

# Configure root logger to ensure consistent formatting across all libraries
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)

# Remove any existing handlers to avoid duplicate logging
for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)

# Add console handler with our desired format
console_handler = logging.StreamHandler()
console_handler.setFormatter(
    logging.Formatter(
        fmt="%(filename)s:%(lineno)d %(asctime)s.%(msecs)03d:%(message)s",
        datefmt="%Y:%m:%d:%H:%M:%S",
    )
)
root_logger.addHandler(console_handler)
logger = logging.getLogger(__name__)


app = FastAPI()

app.include_router(flashcard_router)
app.include_router(journal_router)
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


class AudioMode(enum.Enum):
    LIVE = "live"
    STEP_BY_STEP = "step-by-step"


class ChatContext(pydantic.BaseModel):
    """Manages state for entire chat session including message history"""

    model_config = pydantic.ConfigDict(arbitrary_types_allowed=True)

    websocket: TypedWebSocket
    practice_language: Language
    native_language: Language
    api_key: str | None = None

    client: genai.Client | None = None
    gemini_ctx: object | None = None
    gemini_session: genai_live.AsyncSession | None = None
    state: ChatState | None = None

    aio_tasks: list[asyncio.Task] = pydantic.Field(default_factory=list)
    tasks: list[LongRunningTask] = pydantic.Field(default_factory=list)

    interaction_mode: AudioMode = AudioMode.STEP_BY_STEP
    modality: str = "audio"

    def model_post_init(self, __context) -> None:
        super().model_post_init(__context)
        if self.api_key:
            self.client = genai.Client(
                api_key=self.api_key,
                http_options={"api_version": settings.GEMINI_API_VERSION},
            )

    async def __aenter__(self):
        config = genai_types.LiveConnectConfig()
        config.response_modalities = [genai_types.Modality(self.modality)]
        config.speech_config = genai_types.SpeechConfig(
            voice_config=genai_types.VoiceConfig(
                prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(voice_name="Kore")
            )
        )
        config.system_instruction = genai_types.Content(
            parts=[
                genai_types.Part(
                    text=prompts.LIVE_SYSTEM_INSTRUCTIONS.format(
                        practice_language=self.practice_language.name,
                        today=datetime.now().strftime("%Y-%m-%d"),
                    )
                )
            ]
        )

        self.state = ChatState(
            session=self.gemini_session,
            user_ws=self.websocket,
            modality=self.modality,
        )

        if self.interaction_mode == AudioMode.LIVE:
            assert self.gemini_session is not None
            assert self.client is not None
            assert self.gemini_ctx is not None
            self.gemini_ctx = self.client.aio.live.connect(
                model=settings.LIVE_MODEL_ID, config=config
            )
            self.gemini_session = await self.gemini_ctx.__aenter__()
            # Live mode tasks
            self.tasks.extend(
                [
                    UserReaderTask(self.websocket, self.state),
                    UserWriterTask(self.websocket, self.state),
                    GeminiReaderTask(self.state, self.gemini_session),
                    GeminiWriterTask(self.state, self.gemini_session),
                    BulkTranscriptionTask(
                        self.state,
                        practice_language=self.practice_language,
                        native_language=self.native_language,
                        client=self.client,
                    ),
                ]
            )
        else:
            # Step-by-step mode tasks
            self.tasks.extend(
                [
                    UserReaderTask(self.websocket, self.state),
                    UserWriterTask(self.websocket, self.state),
                    TranscribeAndHintTask(
                        self.state,
                        native_language=self.native_language,
                        practice_language=self.practice_language,
                        client=self.client,
                    ),
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
    practice_language: str = Query(
        ..., description="Language to use for speaking/typing"
    ),
    native_language: str = Query(
        ..., description="Language to use for hints and translations"
    ),
    modality: str = Query("audio", description="Response modality (audio/text)"),
):
    if practice_language not in LANGUAGES:
        await raw_websocket.close(
            code=1008,
            reason=f"Unsupported practice language: {practice_language}",
        )
        return
    if native_language not in LANGUAGES:
        await raw_websocket.close(
            code=1008, reason=f"Unsupported native language: {native_language}"
        )

    websocket = TypedWebSocket(raw_websocket)

    try:
        await websocket.accept()
        logger.info(
            "Starting Gemini practice session: %s",
            practice_language,
        )
        logger.info("Starting practice session with Gemini")

        async with ChatContext(
            websocket=websocket,
            practice_language=LANGUAGES[practice_language],
            native_language=LANGUAGES[native_language],
            modality=modality,
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
    return await translate(request)


@app.post("/api/transcribe", response_model=TranscribeResponse)
async def api_transcribe(request: TranscribeRequest) -> TranscribeResponse:
    return await transcribe(request)


@app.get("/api/languages")
def api_list_languages():
    """Get list of supported languages"""
    return [{"code": code, "name": lang.name} for code, lang in LANGUAGES.items()]


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
