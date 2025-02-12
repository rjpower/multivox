from enum import Enum
from typing import Annotated, Literal, Optional, Union

from pydantic import Base64Bytes, BaseModel, Discriminator, Field, RootModel


class TranscribeRequest(BaseModel):
    api_key: str
    audio: Base64Bytes
    mime_type: str
    sample_rate: Optional[int] = None
    language: str = ""

class HintOption(BaseModel):
    native: str
    translation: str

class HintRequest(BaseModel):
    api_key: str
    history: str
    language: str

class HintResponse(BaseModel):
    hints: list[HintOption]


class VocabularyEntry(BaseModel):
    native: str
    translation: str
    notes: Optional[str] = None

class DictionaryEntry(BaseModel):
    english: str
    native: str
    notes: Optional[str] = None

class TranscribeResponse(BaseModel):
    transcription: str
    chunked: list[str]  # List of terms/phrases
    dictionary: dict[str, DictionaryEntry]  # Mapping of terms to translations
    translation: str


class TranslateRequest(BaseModel):
    text: str
    target_language: str
    source_language: str = ""


class TranslateResponse(BaseModel):
    original: str
    translation: str
    chunked: list[str]  # List of terms/phrases
    dictionary: dict[str, DictionaryEntry]  # Mapping of terms to translations


class PracticeRequest(BaseModel):
    target_language: str
    modality: Optional[str] = "audio"
    test: bool = False


class Scenario(BaseModel):
    id: str  # URL-friendly slug
    title: str
    description: str
    instructions: str


class Chapter(BaseModel):
    title: str
    description: str
    id: str = ""
    conversations: list[Scenario] = Field(default_factory=list)


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"

class MessageType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    TRANSCRIPTION = "transcription"
    HINT = "hint"

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
    mode: Optional[TextMode] = None

class TranscriptionWebSocketMessage(BaseWebSocketMessage):
    type: Literal["transcription"] = "transcription"
    transcription: TranscribeResponse

class AudioWebSocketMessage(BaseWebSocketMessage):
    type: Literal["audio"] = "audio"
    audio: Base64Bytes

class HintWebSocketMessage(BaseWebSocketMessage):
    type: Literal["hint"] = "hint"
    hints: list[HintOption]

class TranslateWebSocketMessage(BaseWebSocketMessage):
    type: Literal["translate"] = "translate"
    original: str
    translation: str
    chunked: list[str]  # List of terms/phrases
    dictionary: dict[str, DictionaryEntry]  # Mapping of terms to translations

WebSocketMessage = Annotated[
    Union[TextWebSocketMessage, TranscriptionWebSocketMessage, AudioWebSocketMessage, HintWebSocketMessage, TranslateWebSocketMessage],
    Discriminator("type"),
]

WebSocketRoot = RootModel[WebSocketMessage]


def parse_websocket_message(data: dict) -> WebSocketMessage:
    return WebSocketRoot.model_validate(data).root


def parse_websocket_message_bytes(data: bytes) -> WebSocketMessage:
    return WebSocketRoot.model_validate_json(data).root


class Language(BaseModel):
    abbreviation: str
    name: str


LANGUAGES = {
    lang.abbreviation: lang for lang in [
        Language(abbreviation="en", name="English"),
        Language(abbreviation="ja", name="Japanese"),
        Language(abbreviation="es", name="Spanish"),
        Language(abbreviation="fr", name="French"),
        Language(abbreviation="de", name="German"),
        Language(abbreviation="it", name="Italian"),
        Language(abbreviation="zh", name="Chinese"),
        Language(abbreviation="ko", name="Korean"),
        Language(abbreviation="ru", name="Russian"),
        Language(abbreviation="pt", name="Portuguese"),
        Language(abbreviation="ar", name="Arabic"),
        Language(abbreviation="hi", name="Hindi"),
        Language(abbreviation="nl", name="Dutch"),
        Language(abbreviation="pl", name="Polish"),
        Language(abbreviation="tr", name="Turkish"),
        Language(abbreviation="vi", name="Vietnamese"),
    ]
}
