from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Model IDs
    LIVE_MODEL_ID: str = "gemini-2.0-flash-exp"
    TRANSCRIPTION_MODEL_ID: str = "gemini-2.0-flash"
    TRANSLATION_MODEL_ID: str = "openai/gpt-4o-mini"
    HINT_MODEL_ID: str = "openai/gpt-4o-mini"

    # Audio settings
    CLIENT_SAMPLE_RATE: int = 16000
    SERVER_SAMPLE_RATE: int = 24000

    # API versions
    GEMINI_API_VERSION: str = "v1alpha"

    class Config:
        env_prefix = "MULTIVOX_"

settings = Settings()
