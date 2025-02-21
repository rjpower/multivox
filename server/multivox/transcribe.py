import datetime
import io
import logging
import wave

from google import genai
from google.genai import types as genai_types
from litellm import atranscription

from multivox.config import settings
from multivox.prompts import (
    TRANSCRIBE_AND_HINT_PROMPT,
)
from multivox.scenarios import SYSTEM_INSTRUCTIONS
from multivox.translate import translate
from multivox.types import (
    LANGUAGES,
    TranscribeAndHintRequest,
    TranscribeAndHintResponse,
    TranscribeRequest,
    TranscribeResponse,
    TranslateRequest,
)

logger = logging.getLogger(__name__)


def extract_sample_rate(mime_type: str) -> int:
    """Extract sample rate from mime type string like 'audio/pcm;rate=16000'"""
    if ";rate=" in mime_type:
        try:
            return int(mime_type.split(";rate=")[1])
        except (IndexError, ValueError):
            pass
    return 16000  # default sample rate


def convert_to_wav(pcm_data: genai_types.Blob) -> genai_types.Blob:
    """Convert raw PCM data to WAV format using rate from mime type"""
    if pcm_data.mime_type == "audio/wav":
        return pcm_data

    sample_rate = extract_sample_rate(pcm_data.mime_type)
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wav_file:
        wav_file.setnchannels(1)  # mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data.data)
    return genai_types.Blob(data=wav_buffer.getvalue(), mime_type="audio/wav")


async def transcribe(
    request: TranscribeRequest,
    model_id: str = settings.TRANSCRIPTION_MODEL_ID,
) -> TranscribeResponse:
    audio_blob = genai_types.Blob(data=request.audio, mime_type=request.mime_type)
    audio_data = convert_to_wav(audio_blob)

    buffer = io.BytesIO(audio_data.data)
    buffer.name = "audio.wav"
    response = await atranscription(
        model=model_id,
        file=buffer,
        language=request.source_language if request.source_language else None,
        response_format="verbose_json",
        timestamp_granularities=["word"],
        api_key=request.api_key,
    )

    transcription = response.text

    # Translate and chunk the response.
    response = await translate(
        TranslateRequest(
            text=response.text,
            source_language=request.source_language,
            target_language=request.target_language,
        )
    )

    return TranscribeResponse(
        source_text=transcription,
        dictionary=response.dictionary,
        chunked=response.chunked,
        translated_text=response.translated_text,
    )


async def transcribe_and_hint(
    request: TranscribeAndHintRequest,
) -> TranscribeAndHintResponse:
    """Transcribe audio and generate hints for the conversation in a single model call"""
    source_language = LANGUAGES[request.source_language]
    target_language = LANGUAGES[request.target_language]
    client = genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options={"api_version": settings.GEMINI_API_VERSION},
    )

    audio_data = None

    if request.audio:
        audio_data = convert_to_wav(
            genai_types.Blob(data=request.audio, mime_type=request.mime_type or "audio/pcm")
        )
        with open("/tmp/test.wav", "wb") as f:
            f.write(audio_data.data)

    system_prompt = (
        "You are an expert at transcription. Transcribe this Japanese audio sample."
    )

    # Format system prompt
    system_prompt = SYSTEM_INSTRUCTIONS.format(
        practice_language=source_language.name,
        today=datetime.date.today().strftime("%Y-%m-%d"),
    )

    system_prompt += TRANSCRIBE_AND_HINT_PROMPT.format(
        source_language=source_language,
        target_language=target_language,
    )

    user_content = [
        f"<SCENARIO>\n{request.scenario}\n</SCENARIO>",
        f"<HISTORY>\n{request.history}\n</HISTORY>",
    ]

    if audio_data:
        user_content.append(
            genai_types.Part.from_bytes(
                data=audio_data.data,
                mime_type="audio/wav",
            )
        )

    response = client.models.generate_content(
        model=request.model_id,
        contents=user_content,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
        ),
    )

    try:
        return TranscribeAndHintResponse.model_validate_json(response.text)
    except Exception:
        logger.exception(
            "Failed to parse transcribe and hint response: %s",
            response.text,
            stack_info=True,
        )
        raise
