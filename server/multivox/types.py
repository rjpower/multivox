from enum import Enum
from typing import Optional
from pydantic import BaseModel

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

class WebSocketMessage(BaseModel):
    type: MessageType
    text: Optional[str] = None
    audio: Optional[str] = None  # Base64 encoded audio data
    role: MessageRole
    mode: Optional[TextMode] = TextMode.APPEND
    end_of_turn: bool = False
