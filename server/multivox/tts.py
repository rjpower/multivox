from dataclasses import dataclass

from google.cloud import texttospeech
from google.oauth2 import service_account

from multivox.cache import default_file_cache
from multivox.config import settings
from multivox.types import Language


@dataclass
class TTSAudio:
    """Represents generated text-to-speech audio data"""
    text: str
    data: bytes


@default_file_cache.cache_fn_async()
async def generate_tts_audio_async(term: str, language: Language) -> TTSAudio | None:
    """Generate TTS audio for text using Google Cloud Text-to-Speech API"""
    if not language.tts_language_code or not language.tts_voice_name:
        return None

    credentials = service_account.Credentials.from_service_account_info(
        settings.GOOGLE_SERVICE_ACCOUNT_INFO
    )
    tts_client = texttospeech.TextToSpeechAsyncClient(credentials=credentials)

    voice = texttospeech.VoiceSelectionParams(
        language_code=language.tts_language_code,
        name=language.tts_voice_name,
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=0.8,
        pitch=0.0,
    )

    synthesis_input = texttospeech.SynthesisInput(text=term)

    try:
        response = await tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
        return TTSAudio(text=term, data=response.audio_content)
    except Exception as e:
        print(f"Google TTS API error for term '{term}': {str(e)}")
        return None


@default_file_cache.cache_fn()
async def generate_tts_audio_sync(term: str, language: Language) -> TTSAudio | None:
    """Generate TTS audio for text using Google Cloud Text-to-Speech API"""
    if not language.tts_language_code or not language.tts_voice_name:
        return None

    credentials = service_account.Credentials.from_service_account_info(
        settings.GOOGLE_SERVICE_ACCOUNT_INFO
    )
    tts_client = texttospeech.TextToSpeechAsyncClient(credentials=credentials)

    voice = texttospeech.VoiceSelectionParams(
        language_code=language.tts_language_code,
        name=language.tts_voice_name,
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=0.8,
        pitch=0.0,
    )

    synthesis_input = texttospeech.SynthesisInput(text=term)

    try:
        response = await tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
        return TTSAudio(text=term, data=response.audio_content)
    except Exception as e:
        print(f"Google TTS API error for term '{term}': {str(e)}")
        return None
