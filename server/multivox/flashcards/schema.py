import enum
from enum import Enum
from typing import Callable, List, Optional, Protocol

from pydantic import BaseModel


class FlashcardLanguage(str, Enum):
    ENGLISH = "english"
    JAPANESE = "japanese"
    SPANISH = "spanish"
    CHINESE = "chinese"
    ARABIC = "arabic"
    BASQUE = "basque"
    BENGALI = "bengali"
    BULGARIAN = "bulgarian"
    CATALAN = "catalan"
    CZECH = "czech"
    DANISH = "danish"
    DUTCH_BE = "dutch_be"
    DUTCH_NL = "dutch_nl"
    FILIPINO = "filipino"
    FINNISH = "finnish"
    FRENCH_CA = "french_ca"
    FRENCH_FR = "french_fr"
    GALICIAN = "galician"
    GERMAN = "german"
    GREEK = "greek"
    GUJARATI = "gujarati"
    HEBREW = "hebrew"
    HINDI = "hindi"
    HUNGARIAN = "hungarian"
    INDONESIAN = "indonesian"
    ITALIAN = "italian"
    KANNADA = "kannada"
    KOREAN = "korean"
    LATVIAN = "latvian"
    LITHUANIAN = "lithuanian"
    MALAY = "malay"
    MALAYALAM = "malayalam"
    MANDARIN_CN = "mandarin_cn"
    MANDARIN_TW = "mandarin_tw"
    MARATHI = "marathi"
    NORWEGIAN = "norwegian"
    POLISH = "polish"
    PORTUGUESE_BR = "portuguese_br"
    PORTUGUESE_PT = "portuguese_pt"
    PUNJABI = "punjabi"
    ROMANIAN = "romanian"
    RUSSIAN = "russian"
    SERBIAN = "serbian"
    SLOVAK = "slovak"
    SPANISH_ES = "spanish_es"
    SPANISH_US = "spanish_us"
    SWEDISH = "swedish"
    TAMIL = "tamil"
    TELUGU = "telugu"
    THAI = "thai"
    TURKISH = "turkish"
    UKRAINIAN = "ukrainian"
    VIETNAMESE = "vietnamese"

class OutputFormat(str, Enum):
    ANKI_PKG = "apkg"
    PDF = "pdf"


class FlashCard(Protocol):
    """A generic flashcard that can represent vocabulary, grammar, or concepts"""

    @property
    def front(self) -> str: ...

    @property
    def front_sub(self) -> Optional[str]: ...

    @property
    def front_context(self) -> Optional[str]: ...

    @property
    def back(self) -> str: ...

    @property
    def back_context(self) -> Optional[str]: ...


class RawFlashCard(BaseModel):
    front: str
    front_sub: str = ""
    front_context: str = ""
    back: str
    back_context: str = ""


class VocabItem(BaseModel):
    term: str
    reading: str = ""
    meaning: str = ""
    context_native: str = ""
    context_en: str = ""
    source: str = ""

    @property
    def front(self) -> str:
        return self.term

    @property
    def front_sub(self) -> Optional[str]:
        return self.reading

    @property
    def front_context(self) -> Optional[str]:
        return self.context_native

    @property
    def back(self) -> str:
        return self.meaning or ""

    @property
    def back_context(self) -> Optional[str]:
        return self.context_en


class SourceMapping(BaseModel):
    """Maps source document fields to VocabItem fields"""

    term: str
    reading: Optional[str] = None
    meaning: Optional[str] = None
    context_native: Optional[str] = None
    context_en: Optional[str] = None


class ConversionStatus(enum.StrEnum):
    RUNNING = "running"
    ERROR = "error"
    DONE = "done"


class ConversionProgress(BaseModel):
    message: str
    status: ConversionStatus
    payload: Optional[str] = None


ProgressLogger = Callable[[str], None]
