import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def find_root():
    path = Path(__file__).parent
    while not (path / "client").exists():
        path = path.parent
    return path


ROOT_DIR = find_root()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        secrets_dir=os.environ.get("SECRETS_DIR", ROOT_DIR / "secrets")
    )

    ROOT_DIR: Path = ROOT_DIR
    DOWNLOAD_DIR: Path = ROOT_DIR / "downloads"

    GOOGLE_SERVICE_ACCOUNT_INFO: dict
    GEMINI_API_KEY: str
    OPENAI_API_KEY: str

    LIVE_MODEL_ID: str = "gemini-2.0-flash-exp"
    TRANSCRIBE_AND_HINT_MODEL_ID: str = "gemini-2.0-flash"
    TRANSCRIPTION_MODEL_ID: str = "openai/whisper-1"
    TRANSLATION_MODEL_ID: str = "gemini/gemini-2.0-flash"
    HINT_MODEL_ID: str = "openai/gpt-4o-mini"
    COMPLETION_MODEL_ID: str = "gemini/gemini-2.0-flash"

    GEMINI_MODEL_ID: str = "gemini/gemini-2.0-flash"

    CLIENT_SAMPLE_RATE: int = 16000
    SERVER_SAMPLE_RATE: int = 24000

    GEMINI_API_VERSION: str = "v1alpha"

    def model_post_init(self, __context) -> None:
        super().model_post_init(__context)

        # expose API keys for litellm
        os.environ["OPENAI_API_KEY"] = self.OPENAI_API_KEY
        os.environ["GEMINI_API_KEY"] = self.GEMINI_API_KEY
        assert isinstance(self.GOOGLE_SERVICE_ACCOUNT_INFO, dict)


settings = Settings()  # type: ignore
