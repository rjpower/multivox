import os
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        secrets_dir=os.environ.get("SECRETS_DIR", ROOT_DIR)
    )
    DOWNLOAD_DIR: Path = ROOT_DIR / "downloads"

    LIVE_MODEL_ID: str = "gemini-2.0-flash-exp"
    TRANSCRIPTION_MODEL_ID: str = "gemini-1.5-flash"
    TRANSLATION_MODEL_ID: str = "openai/gpt-4o-mini"
    HINT_MODEL_ID: str = "openai/gpt-4o-mini"
    COMPLETION_MODEL_ID: str = "gemini/gemini-2.0-flash"

    GEMINI_MODEL_ID: str = "gemini/gemini-2.0-flash"

    CLIENT_SAMPLE_RATE: int = 16000
    SERVER_SAMPLE_RATE: int = 24000

    GEMINI_API_VERSION: str = "v1alpha"

    GOOGLE_SERVICE_ACCOUNT_INFO: dict = Field(default_factory=dict)
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

settings = Settings()
