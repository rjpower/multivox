import time
from enum import Enum
from typing import Annotated, Literal, Optional, Union

from pydantic import Base64Bytes, BaseModel, Discriminator, Field, RootModel

from multivox.config import settings
from multivox.prompts import HINT_PROMPT, TRANSLATION_PROMPT, TRANSLATION_SYSTEM_PROMPT


class Language(BaseModel):
    abbreviation: str
    name: str
    tts_language_code: Optional[str] = None  # For Google TTS
    tts_voice_name: Optional[str] = None     # For Google TTS


LANGUAGES = {
    lang.abbreviation: lang
    for lang in [
        Language(abbreviation="en", name="English", 
                tts_language_code="en-US", tts_voice_name="en-US-Neural2-C"),
        Language(abbreviation="ja", name="Japanese", 
                tts_language_code="ja-JP", tts_voice_name="ja-JP-Neural2-B"),
        Language(abbreviation="es", name="Spanish", 
                tts_language_code="es-ES", tts_voice_name="es-ES-Neural2-A"),
        Language(abbreviation="fr", name="French",
                tts_language_code="fr-FR", tts_voice_name="fr-FR-Neural2-A"),
        Language(abbreviation="de", name="German",
                tts_language_code="de-DE", tts_voice_name="de-DE-Neural2-A"),
        Language(abbreviation="it", name="Italian",
                tts_language_code="it-IT", tts_voice_name="it-IT-Neural2-A"),
        Language(abbreviation="zh", name="Chinese",
                tts_language_code="cmn-CN", tts_voice_name="cmn-CN-Neural2-A"),
        Language(abbreviation="ko", name="Korean",
                tts_language_code="ko-KR", tts_voice_name="ko-KR-Neural2-A"),
        Language(abbreviation="ru", name="Russian",
                tts_language_code="ru-RU", tts_voice_name="ru-RU-Neural2-A"),
        Language(abbreviation="pt", name="Portuguese",
                tts_language_code="pt-BR", tts_voice_name="pt-BR-Neural2-A"),
        Language(abbreviation="ar", name="Arabic",
                tts_language_code="ar-XA", tts_voice_name="ar-XA-Neural2-A"),
        Language(abbreviation="hi", name="Hindi",
                tts_language_code="hi-IN", tts_voice_name="hi-IN-Neural2-A"),
        Language(abbreviation="nl", name="Dutch",
                tts_language_code="nl-NL", tts_voice_name="nl-NL-Neural2-A"),
        Language(abbreviation="pl", name="Polish",
                tts_language_code="pl-PL", tts_voice_name="pl-PL-Wavenet-A"),
        Language(abbreviation="tr", name="Turkish",
                tts_language_code="tr-TR", tts_voice_name="tr-TR-Neural2-A"),
        Language(abbreviation="vi", name="Vietnamese",
                tts_language_code="vi-VN", tts_voice_name="vi-VN-Neural2-A"),
    ]
}


class HintOption(BaseModel):
    source_text: str
    translated_text: str


class HintRequest(BaseModel):
    history: str
    scenario: str
    source_language: str
    target_language: str
    model_id: str = settings.HINT_MODEL_ID
    hint_prompt: str = HINT_PROMPT
    api_key: Optional[str] = None

class HintResponse(BaseModel):
    hints: list[HintOption]


class DictionaryEntry(BaseModel):
    source_text: str
    translated_text: str
    reading: str = ""
    notes: Optional[str] = None


class TranscribeRequest(BaseModel):
    api_key: Optional[str] = None
    audio: Optional[Base64Bytes] = None
    mime_type: Optional[str] = None
    sample_rate: Optional[int] = None
    source_language: str = ""
    target_language: str
    scenario: Optional[str] = None
    history: Optional[str] = None


class TranscribeAndHintRequest(BaseModel):
    scenario: str
    history: str
    audio: Optional[Base64Bytes] = None
    mime_type: Optional[str] = None
    source_language: str
    target_language: str
    model_id: str = settings.TRANSCRIBE_AND_HINT_MODEL_ID


class TranscribeResponse(BaseModel):
    source_text: str
    translated_text: str
    chunked: list[str]  # List of terms/phrases
    dictionary: dict[str, DictionaryEntry]  # Mapping of terms to translations


class TranslateRequest(BaseModel):
    text: str
    source_language: str = "en"
    target_language: str
    model_id: str = settings.TRANSLATION_MODEL_ID
    system_prompt: str = TRANSLATION_SYSTEM_PROMPT
    translation_prompt: str = TRANSLATION_PROMPT
    need_chunks: bool = True
    need_dictionary: bool = True


class TranslateResponse(BaseModel):
    source_text: str
    translated_text: str
    chunked: list[str]
    dictionary: dict[str, DictionaryEntry]


class TranscribeAndHintResponse(BaseModel):
    transcription: str
    translated_text: str
    response_text: str
    chunked: list[str]
    dictionary: dict[str, DictionaryEntry]
    hints: list[HintOption]


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
    SYSTEM = "system"


class MessageType(str, Enum):
    AUDIO = "audio"
    ERROR = "error"
    HINT = "hint"
    INITIALIZE = "initialize"
    PROCESSING = "processing"
    TEXT = "text"
    TRANSCRIPTION = "transcription"
    TRANSLATION = "translation"


# Audio sample rates
CLIENT_SAMPLE_RATE = 16000
SERVER_SAMPLE_RATE = 24000


class BaseWebSocketMessage(BaseModel):
    role: MessageRole
    timestamp: float = Field(default_factory=time.time)
    end_of_turn: bool = False


class InitializeWebSocketMessage(BaseWebSocketMessage):
    """Used as the initial message to establish a conversation."""

    type: Literal[MessageType.INITIALIZE] = MessageType.INITIALIZE
    text: str


class ErrorWebSocketMessage(BaseWebSocketMessage):
    type: Literal[MessageType.ERROR] = MessageType.ERROR
    text: str


class TextWebSocketMessage(BaseWebSocketMessage):
    type: Literal[MessageType.TEXT] = MessageType.TEXT
    text: str


class TranscriptionWebSocketMessage(BaseWebSocketMessage):
    type: Literal[MessageType.TRANSCRIPTION] = MessageType.TRANSCRIPTION
    source_text: str
    translated_text: str
    chunked: list[str]
    dictionary: dict[str, DictionaryEntry]


class AudioWebSocketMessage(BaseWebSocketMessage):
    type: Literal[MessageType.AUDIO] = MessageType.AUDIO
    audio: Base64Bytes
    mime_type: str


class HintWebSocketMessage(BaseWebSocketMessage):
    type: Literal[MessageType.HINT] = MessageType.HINT
    hints: list[HintOption]


class TranslateWebSocketMessage(BaseWebSocketMessage):
    type: Literal[MessageType.TRANSLATION] = MessageType.TRANSLATION
    source_text: str
    translated_text: str
    chunked: list[str]
    dictionary: dict[str, DictionaryEntry]


class ProcessingWebSocketMessage(BaseWebSocketMessage):
    role: MessageRole = MessageRole.SYSTEM
    end_of_turn: bool = True
    type: Literal[MessageType.PROCESSING] = MessageType.PROCESSING
    status: str


WebSocketMessage = Annotated[
    Union[
        InitializeWebSocketMessage,
        TextWebSocketMessage,
        TranscriptionWebSocketMessage,
        AudioWebSocketMessage,
        HintWebSocketMessage,
        TranslateWebSocketMessage,
        ErrorWebSocketMessage,
        ProcessingWebSocketMessage,
    ],
    Discriminator("type"),
]

WebSocketRoot = RootModel[WebSocketMessage]


def parse_websocket_message(data: dict) -> WebSocketMessage:
    return WebSocketRoot.model_validate(data).root


def parse_websocket_message_bytes(data: bytes) -> WebSocketMessage:
    return WebSocketRoot.model_validate_json(data).root


class ChatMessage(BaseModel):
    """Represents a single chat message"""

    role: MessageRole
    content: str
