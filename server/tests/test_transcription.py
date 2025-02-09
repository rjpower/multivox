import base64
import pathlib

import pytest
from fastapi.testclient import TestClient
from multivox.app import app


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
            "mime_type": f"audio/pcm;rate={sample_rate}",
            "language": "Japanese",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "transcription" in data
    assert isinstance(data["transcription"], str)
    assert len(data["transcription"]) > 0
    print(f"Transcription at {sample_rate} Hz: {data}")
