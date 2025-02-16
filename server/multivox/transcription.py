import array
import io
import logging
import wave
from typing import Type

from google.genai import types as genai_types
from litellm import atranscription
from pydantic import BaseModel

from multivox.config import settings
from multivox.translation import translate
from multivox.types import (
    LANGUAGES,
    HintResponse,
    Language,
    TranscribeResponse,
)

logger = logging.getLogger(__name__)

TRANSCRIPTION_FORMAT = """
transcription: direct transcription of the audio in the native language
dictionary: key-value pairs of important terms and their translations
chunked: list of speech chunks separated by punctuation, this should align with `dictionary` for lookup
translation: native English translation of the content
"""

TRANSCRIPTION_PROMPT = f"""
You are a language expert. 

Analyze the attached audio and provide a structured response in this exact JSON format.
Include translations for important vocabulary, phrases, and idioms in the dictionary.

{TRANSCRIPTION_FORMAT}

Generate only a single top level object (not a list) with the following structure:

{{
    "transcription": "はい、かしこまりました。ご用をでしょうか。",
    "dictionary": {{
        "<key term>": {{
            "english": "English meaning",
            "native": "Native meaning",
            "notes": "Optional usage notes"
        }}
    }},
    "chunked": ["はい、", "かしこまりました。", "ご用", "をでしょうか。"],
    "translation": "Complete English translation of the full text",
}}

Only output valid JSON. Do not include any other text or explanations.
"""

STREAMING_TRANSCRIPTION_SYSTEM_PROMPT = """
You are a language expert.
You transcribe conversations and provide hints to the user.
You use the `transcribe` tool to provide a transcript of the conversation.
You use the `hint` tool to provide hints to the user.
Don't use `print` or `log` to output text, call the tools instead.
You only provide hints for the user, not the assistant.


Assume the language is {target_language}.
When you see <INSTRUCTIONS>...</INSTRUCTIONS>, follow the instructions to provide a response.
Don't include <INSTRUCTIONS></INSTRUCTIONS> as part of the transcript.
"""

STREAMING_TRANSCRIPTION_INITIAL_PROMPT = """
"""

STREAMING_TRANSCRIPTION_PROMPT = f"""
<INSTRUCTIONS>
Output a transcript of the conversation since the last transcribe() call.
Include translations for important vocabulary, phrases, and idioms in the dictionary.

{TRANSCRIPTION_FORMAT}

Call the `transcribe` tool with the following arguments:


```
transcribe({{
  transcription="はい、かしこまりました。ご用をでしょうか。",
  dictionary={{
    "<key term>": {{
        "english": "English meaning",
        "native": "Native meaning",
        "notes": "Optional usage notes"
    }}
  }},
  chunked=["はい、", "かしこまりました。", "ご用", "をでしょうか。"],
  translation="Complete English translation of the full text",
}})
```

Only call `transcribe`.
Perform no other operations.
You _must_ call `transcribe` before ending your turn.
</INSTRUCTIONS>
"""

def pcm_to_mp3(pcm_data: bytes, mime_type: str) -> bytes:
    """Convert raw PCM data to MP3 format using rate from mime type"""
    sample_rate = extract_sample_rate(mime_type)

    # Convert bytes to array of signed 16-bit integers
    pcm_array = array.array('h')
    pcm_array.frombytes(pcm_data)

    # Create AudioSegment from raw PCM data
    from pydub import AudioSegment  # type: ignore

    audio_segment = AudioSegment(
        pcm_array.tobytes(),
        frame_rate=sample_rate,
        sample_width=2,  # 16-bit
        channels=1  # mono
    )

    # Export as MP3
    mp3_buffer = io.BytesIO()
    audio_segment.export(mp3_buffer, format="mp3")
    return mp3_buffer.getvalue()


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
    audio_data: bytes,
    mime_type: str,
    source_language: Language | None,
    transcription_prompt: str = TRANSCRIPTION_PROMPT,
    model_id: str = settings.TRANSCRIPTION_MODEL_ID,
) -> TranscribeResponse:
    if mime_type.startswith("audio/pcm"):
        audio_data = pcm_to_wav(audio_data, mime_type)
        mime_type = "audio/wav"

    buffer = io.BytesIO(audio_data)
    buffer.name = "audio.wav"
    response = await atranscription(
        model="openai/whisper-1",
        file=buffer,
        language=source_language.abbreviation if source_language else None,
        response_format="verbose_json",
        timestamp_granularities=["word"],
        api_key=settings.OPENAI_API_KEY,
    )

    transcription = response.text

    # Translate and chunk the response.
    response = await translate(
        text=response.text,
        source_language=source_language,
        target_language=LANGUAGES["en"],
    )

    return TranscribeResponse(
        transcription=transcription,
        dictionary=response.dictionary,
        chunked=response.chunked,
        translation=response.translation,
    )


def schema_from_type(model_type: Type[BaseModel]) -> genai_types.Schema:
    """Convert a Pydantic model to a JSON schema for Gemini function declarations"""
    schema = model_type.model_json_schema()

    # Remove Pydantic-specific fields that Gemini doesn't need
    schema.pop("title", None)
    schema.pop("description", None)

    # Handle nested models by flattening the schema
    if "$defs" in schema:
        # For each property that references a definition
        for prop_schema in schema.get("properties", {}).values():
            if isinstance(prop_schema, dict):
                # Handle array items with references
                if prop_schema.get("type") == "array" and "items" in prop_schema:
                    items_schema = prop_schema["items"]
                    if isinstance(items_schema, dict):
                        ref = items_schema.get("$ref", "")
                        if ref.startswith("#/$defs/"):
                            def_name = ref.split("/")[-1]
                            if def_name in schema["$defs"]:
                                def_schema = schema["$defs"][def_name]
                                # Replace array items with actual schema
                                prop_schema["items"] = {
                                    "type": "object",
                                    "properties": def_schema.get("properties", {}),
                                    "required": def_schema.get("required", [])
                                }

                # Handle dictionary references
                elif prop_schema.get("type") == "object" and "additionalProperties" in prop_schema:
                    ref = prop_schema["additionalProperties"].get("$ref", "")
                    if ref.startswith("#/$defs/"):
                        def_name = ref.split("/")[-1]
                        if def_name in schema["$defs"]:
                            def_schema = schema["$defs"][def_name]
                            # Replace dictionary with properties schema
                            prop_schema.pop("additionalProperties")
                            prop_schema.update({
                                "type": "object",
                                "properties": def_schema.get("properties", {}),
                                "required": def_schema.get("required", [])
                            })

        # Remove the definitions after expanding them
        schema.pop("$defs")

    def _remove_crap(d):
        if "title" in d:
            d.pop("title")
        if "notes" in d:
            d.pop("notes")

        for prop in d.values():
            if isinstance(prop, dict):
                _remove_crap(prop)

    _remove_crap(schema)
    return genai_types.Schema.model_validate(schema)


def streaming_transcription_config(
    language: Language,
) -> genai_types.LiveConnectConfig:
    """Get Gemini configuration for streaming transcription"""
    config = genai_types.LiveConnectConfig(
        generation_config=genai_types.GenerationConfig(
            response_mime_type="application/json"
        )
    )

    config.response_modalities = [genai_types.Modality.TEXT]
    config.system_instruction = genai_types.Content(
        parts=[
            genai_types.Part(
                text=STREAMING_TRANSCRIPTION_SYSTEM_PROMPT.format(
                    target_language=language.name
                )
            )
        ]
    )

    config.tools = [
        genai_types.Tool(
            function_declarations=[
                genai_types.FunctionDeclaration(
                    name="transcribe",
                    parameters=schema_from_type(TranscribeResponse),
                ),
                genai_types.FunctionDeclaration(
                    name="hint",
                    parameters=schema_from_type(HintResponse),
                ),
            ]
        )
    ]
    return config
