from enum import Enum
from typing import Annotated, Literal, Optional, Union

from pydantic import Base64Bytes, BaseModel, Discriminator, RootModel


class TranslateRequest(BaseModel):
    text: str
    language: str

class TranscribeRequest(BaseModel):
    audio: Base64Bytes
    mime_type: str
    sample_rate: Optional[int] = None
    language: str = ""


class VocabularyEntry(BaseModel):
    native: str
    translation: str
    notes: Optional[str] = None

class DictionaryEntry(BaseModel):
    translation: str
    notes: Optional[str] = None

class TranscribeResponse(BaseModel):
    transcription: str
    chunked: list[str]  # List of terms/phrases
    dictionary: dict[str, DictionaryEntry]  # Mapping of terms to translations
    translation: Optional[str] = None

TranslateResponse = TranscribeResponse

class ScenarioDifficulty(int, Enum):
    BEGINNER = 1
    ELEMENTARY = 2
    PRE_INTERMEDIATE = 3
    INTERMEDIATE = 4
    UPPER_INTERMEDIATE = 5
    PRE_ADVANCED = 6
    ADVANCED = 7
    UPPER_ADVANCED = 8
    EXPERT = 9
    MASTERY = 10

class ScenarioDescription(BaseModel):
    id: str
    title: str
    difficulty: ScenarioDifficulty
    summary: str

class Scenario(BaseModel):
    id: str
    title: str
    instructions: str
    difficulty: ScenarioDifficulty


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"

class MessageType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    TRANSCRIPTION = "transcription"

class TextMode(str, Enum):
    APPEND = "append"
    REPLACE = "replace"

# Audio sample rates
CLIENT_SAMPLE_RATE = 16000
SERVER_SAMPLE_RATE = 24000

class BaseWebSocketMessage(BaseModel):
    role: MessageRole
    end_of_turn: bool = False

class TextWebSocketMessage(BaseWebSocketMessage):
    type: Literal["text"] = "text"
    text: str
    mode: Optional[TextMode] = TextMode.APPEND

class TranscriptionWebSocketMessage(BaseWebSocketMessage):
    type: Literal["transcription"] = "transcription"
    transcription: TranscribeResponse

class AudioWebSocketMessage(BaseWebSocketMessage):
    type: Literal["audio"] = "audio"
    audio: Base64Bytes

WebSocketMessage = Annotated[
    Union[TextWebSocketMessage, TranscriptionWebSocketMessage, AudioWebSocketMessage],
    Discriminator("type"),
]

WebSocketRoot = RootModel[WebSocketMessage]


def parse_websocket_message(data: dict) -> WebSocketMessage:
    return WebSocketRoot.model_validate(data).root


def parse_websocket_message_bytes(data: bytes) -> WebSocketMessage:
    return WebSocketRoot.model_validate_json(data).root
