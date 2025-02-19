import base64
import os
import pathlib

import pytest
from fastapi.testclient import TestClient
from google.genai import types as genai_types
from multivox.app import app
from multivox.transcribe import transcribe_and_hint
from multivox.types import Language, TranscribeResponse


@pytest.fixture
def audio_data() -> genai_types.Blob:
    """Load test audio file as a Blob"""
    audio_path = pathlib.Path(__file__).parent / "data" / "checkin.wav"
    with open(audio_path, "rb") as f:
        # Skip WAV header (44 bytes)
        f.seek(44)
        raw_audio = f.read()
    return genai_types.Blob(data=raw_audio, mime_type="audio/pcm;rate=16000")


@pytest.fixture
def languages() -> tuple[Language, Language]:
    """Return source and target languages for testing"""
    return (
        Language(name="Japanese", abbreviation="ja"),
        Language(name="English", abbreviation="en"),
    )


@pytest.mark.asyncio
async def test_transcribe_and_hint_conversation_flow(
    audio_data: genai_types.Blob,
    languages: tuple[Language, Language],
) -> None:
    """Test transcribe_and_hint in a conversation flow"""
    source_lang, target_lang = languages
    api_key = os.environ["GEMINI_API_KEY"]
    
    # Initial scenario
    scenario = "You are checking into a hotel in Japan"
    history = ""

    # First transcription
    response1 = await transcribe_and_hint(
        scenario=scenario,
        history=history,
        audio_data=audio_data,
        source_language=source_lang,
        target_language=target_lang,
        api_key=api_key,
    )

    print(response1)

    assert response1.source_text
    assert response1.translated_text
    assert response1.chunked
    assert response1.dictionary
    
    # Update history with first exchange
    history += f"\nUser: {response1.source_text}\nAssistant: {response1.translated_text}"

    # Second transcription with updated history
    response2 = await transcribe_and_hint(
        scenario=scenario,
        history=history,
        audio_data=audio_data,
        source_language=source_lang,
        target_language=target_lang,
        api_key=api_key,
    )

    print(response2)

    assert response2.source_text
    assert response2.translated_text
    assert response2.chunked
    assert response2.dictionary
    
    # Verify responses are different
    assert response1.source_text != response2.source_text
    assert response1.translated_text != response2.translated_text


@pytest.mark.parametrize("sample_rate", [8000, 16000, 44100, 48000])
def test_transcribe_endpoint(sample_rate):
    """Test the transcription API endpoint with a real audio file at different sample rates"""
    client = TestClient(app)

    # Get path to test audio file
    audio_path = pathlib.Path(__file__).parent / "data" / "checkin.wav"

    # Read the WAV file directly as raw PCM
    with open(audio_path, "rb") as f:
        # Skip WAV header (44 bytes)
        f.seek(44)
        raw_audio = f.read()

    audio_b64 = base64.b64encode(raw_audio).decode("utf-8")

    response = client.post(
        "/api/transcribe",
        json={
            "audio": audio_b64,
            "mime_type": "audio/pcm",
            "sample_rate": sample_rate,
            "source_language": "ja",
            "target_language": "en",
            "api_key": os.environ["GEMINI_API_KEY"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    transcription = TranscribeResponse.model_validate(data)
    assert transcription.chunked
    assert transcription.dictionary
    assert transcription.source_text
    assert transcription.translated_text

    print(f"Transcription at {sample_rate} Hz: {data}")
