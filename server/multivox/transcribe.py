import base64
import datetime
import io
import logging
import wave

from google.genai import types as genai_types
from litellm import acompletion, atranscription

from multivox.config import settings
from multivox.prompts import (
    TRANSCRIBE_AND_HINT_PROMPT,
    TRANSCRIPTION_PROMPT,
)
from multivox.scenarios import SYSTEM_INSTRUCTIONS
from multivox.translate import translate
from multivox.types import (
    Language,
    TranscribeAndHintResponse,
    TranscribeResponse,
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
    audio_data: genai_types.Blob,
    source_language: Language,
    target_language: Language,
    api_key: str | None = None,
    transcription_prompt: str = TRANSCRIPTION_PROMPT,
    model_id: str = settings.TRANSCRIPTION_MODEL_ID,
) -> TranscribeResponse:
    audio_data = convert_to_wav(audio_data)

    buffer = io.BytesIO(audio_data.data)
    buffer.name = "audio.wav"
    response = await atranscription(
        model=model_id,
        file=buffer,
        language=source_language.abbreviation if source_language else None,
        response_format="verbose_json",
        timestamp_granularities=["word"],
        # api_key=api_key,
    )

    transcription = response.text

    # Translate and chunk the response.
    response = await translate(
        text=response.text,
        source_language=source_language,
        target_language=target_language,
        # api_key=api_key,
    )

    return TranscribeResponse(
        source_text=transcription,
        dictionary=response.dictionary,
        chunked=response.chunked,
        translated_text=response.translated_text,
    )


async def transcribe_and_hint(
    scenario: str,
    history: str,
    audio_data: genai_types.Blob,
    source_language: Language,
    target_language: Language,
    model_id: str = settings.TRANSCRIBE_AND_HINT_MODEL_ID,
    system_prompt: str = SYSTEM_INSTRUCTIONS,
    api_key: str | None = None,
) -> TranscribeAndHintResponse:
    """Transcribe audio and generate hints for the conversation in a single model call"""
    if isinstance(audio_data, genai_types.Blob):
        audio_data = convert_to_wav(audio_data)

    # Then use LLM to analyze transcription and generate hints
    system_prompt = system_prompt.format(
        practice_language=source_language.name,
        today=datetime.date.today().strftime("%Y-%m-%d"),
    )

    system_prompt += TRANSCRIBE_AND_HINT_PROMPT.format(
        source_language=source_language,
        target_language=target_language,
    )

    logger.info(f"History: {history}")

    user_content = [
        {
            "type": "text",
            "text": f"<SCENARIO>\n{scenario}\n</SCENARIO>",
        },
        {
            "type": "text",
            "text": f"<HISTORY>\n{history}\n</HISTORY>",
        },
    ]

    if audio_data:
        user_content.append(
            {
                "type": "input_audio",
                "input_audio": {
                    "data": base64.b64encode(audio_data.data),
                    "format": "wav",
                },
            }
        )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": user_content,
        },
    ]

    llm_response = await acompletion(
        model=model_id,
        messages=messages,
        response_format={"type": "json_object"},
        api_key=api_key,
    )

    content = llm_response.choices[0].message.content  # type: ignore

    try:
        return TranscribeAndHintResponse.model_validate_json(content)
    except Exception:
        logger.exception(
            "Failed to parse transcribe and hint response: %s",
            content,
            stack_info=True,
        )
        raise
