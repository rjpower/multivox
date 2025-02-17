import enum
import logging
import queue
import tempfile
import threading
import traceback
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from multivox.config import settings
from multivox.flashcards.lib import (
    CSVProcessConfig,
    SRTProcessConfig,
    infer_field_mapping,
    process_csv,
    process_srt,
    read_csv,
)
from multivox.flashcards.schema import FlashcardLanguage, OutputFormat, SourceMapping
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class GenerateRequest(BaseModel):
    mode: str
    content: str
    format: OutputFormat
    target_language: FlashcardLanguage
    include_audio: bool = False
    field_mapping: Optional[SourceMapping] = None


class ProgressType(enum.StrEnum):
    INFO = "info"
    ERROR = "error"
    SUCCESS = "success"


class ProgressMessage(BaseModel):
    text: str
    type: str
    url: str | None = None


class CSVAnalyzeRequest(BaseModel):
    content: str


class CSVAnalyzeResponse(BaseModel):
    headers: List[str] = Field(default_factory=list)
    preview_rows: List[Dict[str, str]] = Field(default_factory=list)
    separator: str = ""
    suggestions: Optional[Dict] = None
    error: Optional[str] = None


class ProcessingTask:
    """Handles a single processing task in its own thread with progress updates"""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.message_queue: queue.Queue[ProgressMessage] = queue.Queue()
        self.stop_event = threading.Event()
        self.processing_thread: Optional[threading.Thread] = None

    def log_progress(self, text: str, type: ProgressType = ProgressType.INFO):
        """Add a progress message to the queue"""
        logger.info("Task progress: %s %s", type, text)
        if not self.stop_event.is_set():
            self.message_queue.put(ProgressMessage(text=text, type=type))

    async def run_task(self, request: GenerateRequest):
        settings.DOWNLOAD_DIR.mkdir(exist_ok=True)
        with tempfile.NamedTemporaryFile(
            dir=settings.DOWNLOAD_DIR,
            suffix=".apkg" if request.format == OutputFormat.ANKI_PKG else ".pdf",
            delete=False,
        ) as tmp:
            output_path = Path(tmp.name)

        # Start processing thread
        self.processing_thread = threading.Thread(
            target=self._task, args=(request, output_path)
        )
        self.processing_thread.start()

        # Handle messages until processing is complete
        while not self.stop_event.is_set():
            try:
                msg: ProgressMessage = self.message_queue.get(timeout=0.1)
                await self.websocket.send_text(msg.model_dump_json())
                if msg.type in (ProgressType.ERROR, ProgressType.SUCCESS):
                    self.stop()
                    break
            except queue.Empty:
                continue
            except WebSocketDisconnect:
                self.stop()
                break

    def _task(self, request: GenerateRequest, output_path: Path):
        """Run the actual processing in a thread"""
        try:
            if request.mode == "csv":  # CSV mode
                assert request.field_mapping
                _, df = read_csv(request.content)
                csv_config = CSVProcessConfig(
                    df=df,
                    target_language=request.target_language,
                    output_path=output_path,
                    output_format=request.format,
                    include_audio=request.include_audio,
                    field_mapping=request.field_mapping,
                    progress_logger=self.log_progress,
                )
                process_csv(csv_config)
            else:  # SRT mode
                with tempfile.NamedTemporaryFile(suffix=".srt", mode="w") as srt:
                    srt.write(request.content)
                    srt.flush()

                    srt_config = SRTProcessConfig(
                        srt_path=Path(srt.name),
                        output_path=output_path,
                        output_format=request.format,
                        include_audio=request.include_audio,
                        target_language=request.target_language,
                        progress_logger=self.log_progress,
                    )
                    process_srt(srt_config)

            if not self.stop_event.is_set():
                self.message_queue.put(
                    ProgressMessage(
                        text="Processing complete.",
                        type=ProgressType.SUCCESS,
                        url="/downloads/" + output_path.name,
                    )
                )
        except Exception as e:
            if not self.stop_event.is_set():
                msg = traceback.format_exc()
                self.log_progress(
                    f"Processing error: {str(e)}\n{msg}", ProgressType.ERROR
                )

    def stop(self):
        """Stop processing and cleanup"""

        def _raise_on_log(*args, **kw):
            raise RuntimeError("Task stopped")

        self.log_progress = _raise_on_log
        self.stop_event.set()


router = APIRouter(prefix="/api/flashcards")


@router.get("/languages")
async def get_languages():
    """Get list of supported languages"""
    return [
        {"code": lang.value, "name": lang.name.title().replace("_", " ")}
        for lang in FlashcardLanguage
    ]


@router.post("/analyze", response_model=CSVAnalyzeResponse)
async def analyze_csv(request: CSVAnalyzeRequest):
    """Analyze CSV structure and suggest field mappings"""
    try:
        separator, df = read_csv(request.content)
        logger.info("Read CSV with shape: %s", df.shape)
        suggestions = infer_field_mapping(df)
        df = df.dropna(axis="columns", how="all")  # Only drop completely empty columns

        return CSVAnalyzeResponse(
            headers=df.columns.tolist(),
            preview_rows=df.head(5).fillna("").to_dict(orient="records"),
            separator=separator,
            suggestions=suggestions,
        )
    except Exception as e:
        return CSVAnalyzeResponse(error=str(e))


@router.websocket("/generate")
async def generate_flashcards(websocket: WebSocket):
    """WebSocket endpoint for flashcard generation"""
    await websocket.accept()
    try:
        task = ProcessingTask(websocket)
        data = await websocket.receive_text()
        request = GenerateRequest.model_validate_json(data)
        await task.run_task(request)
        logger.info("Finished flashcard task.")
    except WebSocketDisconnect:
        task.stop()
    except Exception as e:
        logger.exception("Error during processing.", stack_info=True)
        await websocket.send_text(
            ProgressMessage(text=str(e), type=ProgressType.ERROR).model_dump_json()
        )
    finally:
        task.stop()
        logger.info("Closing websocket.")
        await websocket.close()
