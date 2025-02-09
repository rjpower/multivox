from enum import Enum
from typing import Optional

from pydantic import Base64Bytes, BaseModel


class TranslateRequest(BaseModel):
    text: str
    language: str

class TranslateResponse(BaseModel):
    translation: str


class TranscribeRequest(BaseModel):
    audio: Base64Bytes
    mime_type: str
    language: str = ""


class TranscribeResponse(BaseModel):
    transcription: str


class Scenario(BaseModel):
    id: str
    title: str
    instructions: str


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"

class MessageType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"

class TextMode(str, Enum):
    APPEND = "append"
    REPLACE = "replace"

# Audio sample rates
CLIENT_SAMPLE_RATE = 16000
SERVER_SAMPLE_RATE = 24000

class WebSocketMessage(BaseModel):
    type: MessageType
    text: Optional[str] = None
    audio: Optional[Base64Bytes] = None
    role: MessageRole
    mode: Optional[TextMode] = TextMode.APPEND
    end_of_turn: bool = False
