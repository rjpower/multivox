import io
import logging
import wave

from google import genai
from google.genai import types as genai_types

from multivox.config import settings
from multivox.types import (
    Language,
    TranscribeResponse,
)

logger = logging.getLogger(__name__)

TRANSCRIPTION_PROMPT = """
You are a language expert. 

Analyze the attached audio and provide a structured response in this exact JSON format.

transcription: direct transcription of the audio in the native language
dictionary: key-value pairs of important terms and their translations
chunked: list of speech chunks separated by punctuation, this should align with `dictionary` for lookup
translation: native English translation of the content

Generate only a single top level object (not a list) with the following structure:

{
    "transcription": "はい、かしこまりました。ご用をでしょうか。",
    "dictionary": {
        "<key term>": {
            "english": "English meaning",
            "native": "Native meaning",
            "notes": "Optional usage notes"
        }
    },
    "chunked": ["はい、", "かしこまりました。", "ご用", "をでしょうか。"],
    "translation": "Complete English translation of the full text",
}

Only output valid JSON. Do not include any other text or explanations.
Include translations for important vocabulary, phrases, and idioms in the dictionary.
"""

def extract_sample_rate(mime_type: str) -> int:
    """Extract sample rate from mime type string like 'audio/pcm;rate=16000'"""
    if ";rate=" in mime_type:
        try:
            return int(mime_type.split(";rate=")[1])
        except (IndexError, ValueError):
            pass
    return 16000  # default sample rate

def pcm_to_wav(pcm_data: bytes, mime_type: str) -> bytes:
    """Convert raw PCM data to WAV format using rate from mime type"""
    sample_rate = extract_sample_rate(mime_type)
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    return wav_buffer.getvalue()

async def transcribe(
    client: genai.Client,
    audio: genai_types.Blob,
    language: Language | None,
    transcription_prompt: str = TRANSCRIPTION_PROMPT,
) -> TranscribeResponse:
    data = audio.data
    mime_type = audio.mime_type

    # Convert PCM to WAV if needed
    if mime_type.startswith("audio/pcm"):
        data = pcm_to_wav(data, mime_type)
        mime_type = "audio/wav"

    language_prompt = f"Assume the language is {language.name}.\n" if language else "\n"

    response = await client.aio.models.generate_content(
        model=settings.TRANSCRIPTION_MODEL_ID,
        contents=[
            transcription_prompt,
            language_prompt,
            genai_types.Part.from_bytes(
                data=data,
                mime_type=mime_type,
            ),
        ],
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    try:
        return TranscribeResponse.model_validate_json(response.text)
    except Exception:
        logger.warning(f"Failed to parse {response.text} as TranscribeResponse")
        raise


def streaming_transcription_config(
    language: Language | None,
) -> genai_types.LiveConnectConfig:
    """Get Gemini configuration for streaming transcription"""
    language_prompt = f"Assume the language is {language.name}.\n" if language else "\n"
    config = genai_types.LiveConnectConfig()
    config.response_modalities = [genai_types.Modality.TEXT]
    config.system_instruction = genai_types.Content(
        parts=[genai_types.Part(text=TRANSCRIPTION_PROMPT + "\n" + language_prompt)]
    )
    config.tools = [
        genai_types.Tool(
            function_declarations=[
                genai_types.FunctionDeclaration(
                    name="transcribe",
                    description="Transcribes the incoming audio stream.",
                    parameters={},
                ),
                genai_types.FunctionDeclaration(
                    name="hint",
                    description="Generates a hint for the user.",
                    parameters={},
                ),
            ]
        )
    ]
    return config


def create_audio_blob(audio_data: bytes, sample_rate: int) -> genai_types.Blob:
    """Create a Gemini Blob from audio data"""
    return genai_types.Blob(
        data=audio_data,
        mime_type=f"audio/pcm;rate={sample_rate}"
    )
