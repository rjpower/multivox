import base64
import json
import pathlib

from fastapi.testclient import TestClient
from multivox.app import app
from multivox.types import MessageRole, MessageType, WebSocketMessage


def test_practice_session_basic():
    """Test basic websocket connection and initial response"""
    client = TestClient(app)

    # Use a known scenario ID from the test data
    scenario_id = "hotel"

    with client.websocket_connect(f"/api/practice/{scenario_id}?lang=ja") as websocket:
        # We should receive the initial translated instructions
        response = websocket.receive_text()
        assert response, "Should receive initial response"
        assert len(response) > 0, "Response should not be empty"

        # Test sending some audio data
        websocket.send_bytes(b"test audio data")
        response = websocket.receive_text()
        assert response, "Should receive response to audio input"


def test_practice_session_with_audio():
    """Test websocket connection with real audio file input"""
    client = TestClient(app)
    scenario_id = "hotel"

    # Get path to test audio file
    audio_path = pathlib.Path(__file__).parent / "data" / "checkin.wav"

    with client.websocket_connect(f"/api/practice/{scenario_id}?lang=ja") as websocket:
        # Wait for initial instructions
        while True:
            response = json.loads(websocket.receive_text())
            msg = WebSocketMessage.model_validate(response)
            print("RECEIVED", msg)
            if msg.end_of_turn:
                break
            assert msg.text, "Should receive initial instructions"

        print("FINISHED INITIAL RESPONSE")

        # Read the WAV file directly as raw PCM
        with open(audio_path, "rb") as f:
            # Skip WAV header (44 bytes)
            f.seek(44)
            raw_audio = f.read()

        message = WebSocketMessage(
            type=MessageType.AUDIO,
            audio=base64.b64encode(raw_audio).decode(),
            role=MessageRole.USER,
        )
        print("Sending audio message")
        websocket.send_json(message.model_dump())

        # Wait for response to audio
        while True:
            response = json.loads(websocket.receive_text())
            msg = WebSocketMessage.model_validate(response)
            print("READING RESPONSE", msg)
            if msg.end_of_turn:
                break


if __name__ == "__main__":
    test_practice_session_basic()
    test_practice_session_with_audio()
