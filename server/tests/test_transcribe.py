import base64
import pathlib

import pytest
from fastapi.testclient import TestClient
from google.genai import types as genai_types
from multivox.app import app
from multivox.transcribe import transcribe_and_hint
from multivox.types import Language, TranscribeAndHintRequest, TranscribeResponse


@pytest.fixture
def namae_wa() -> genai_types.Blob:
    """Load test audio file as a Blob"""
    audio_path = pathlib.Path(__file__).parent / "data" / "namae_wa.wav"
    with open(audio_path, "rb") as f:
        raw_audio = f.read()
    return genai_types.Blob(data=raw_audio, mime_type="audio/wav")


@pytest.fixture
def checkin() -> genai_types.Blob:
    """Load test audio file as a Blob"""
    audio_path = pathlib.Path(__file__).parent / "data" / "checkin.wav"
    with open(audio_path, "rb") as f:
        raw_audio = f.read()
    return genai_types.Blob(data=raw_audio, mime_type="audio/wav")


@pytest.fixture
def languages() -> tuple[Language, Language]:
    """Return source and target languages for testing"""
    return (
        Language(name="Japanese", abbreviation="ja"),
        Language(name="English", abbreviation="en"),
    )


@pytest.mark.asyncio
async def test_transcribe_and_hint_conversation_flow(
    namae_wa: genai_types.Blob,
    practice_lang: Language,
    native_lang: Language,
    checkin: genai_types.Blob,
) -> None:
    """Test transcribe_and_hint in a conversation flow"""
    # Initial scenario
    scenario = "You are checking into a hotel in Japan"
    history = ""

    assert namae_wa.data
    assert len(namae_wa.data) > 1000

    # First transcription
    response1 = await transcribe_and_hint(
        TranscribeAndHintRequest(
            scenario=scenario,
            history=history,
            audio=base64.b64encode(checkin.data),
            mime_type=checkin.mime_type,
            practice_language=practice_lang.abbreviation,
            native_language=native_lang.abbreviation,
        )
    )

    print(response1)

    assert response1.transcription
    assert response1.translated_text
    assert response1.chunked
    assert response1.dictionary

    # Update history with first exchange
    history += (
        f"\nUser: {response1.transcription}\nAssistant: {response1.translated_text}"
    )

    # Second transcription with updated history
    response2 = await transcribe_and_hint(
        TranscribeAndHintRequest(
            scenario=scenario,
            history=history,
            audio=base64.b64encode(namae_wa.data),
            mime_type=namae_wa.mime_type,
            practice_language=practice_lang.abbreviation,
            native_language=native_lang.abbreviation,
        )
    )

    print(response2)

    assert response2.transcription
    assert response2.translated_text
    assert response2.chunked
    assert response2.dictionary

    # Verify responses are different
    assert response1.transcription != response2.transcription
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
