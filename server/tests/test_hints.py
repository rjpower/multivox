import base64
import pathlib

from fastapi.testclient import TestClient
from multivox.app import app
from multivox.types import HintOption, HintResponse


def test_hints_api():
    """Test the hints API endpoint with audio input"""
    client = TestClient(app)

    # Get path to test audio file
    audio_path = pathlib.Path(__file__).parent / "data" / "checkin.wav"

    # Read the WAV file directly as raw PCM
    with open(audio_path, "rb") as f:
        # Skip WAV header (44 bytes)
        f.seek(44)
        raw_audio = f.read()

    # Make request
    response = client.post(
        "/api/hints",
        json={
            "audio": base64.b64encode(raw_audio).decode(),
            "mime_type": "audio/pcm",
            "language": "ja",
            "num_hints": 3
        }
    )

    # Check response
    assert response.status_code == 200
    
    # Validate response structure
    hint_response = HintResponse.model_validate(response.json())
    assert len(hint_response.hints) == 3
    
    # Check hint structure
    for hint in hint_response.hints:
        assert isinstance(hint, HintOption)
        assert hint.native
        assert hint.translation
