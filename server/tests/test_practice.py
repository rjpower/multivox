import base64
import json
import pathlib
import wave

from fastapi.testclient import TestClient
from multivox.app import app
from multivox.scenarios import list_scenarios
from multivox.types import (
    AudioWebSocketMessage,
    MessageRole,
    MessageType,
    Scenario,
    TextWebSocketMessage,
    parse_websocket_message,
)

# Use a known scenario ID from the test data
SCENARIO_ID = list_scenarios()[0].id

def test_scenarios_api():
    """Test the scenarios API endpoint"""
    client = TestClient(app)
    response = client.get("/api/scenarios")
    
    assert response.status_code == 200
    scenarios = response.json()
    assert isinstance(scenarios, list)
    assert len(scenarios) > 0
    
    # Check scenario structure
    scenario = scenarios[0]
    assert "id" in scenario
    assert "title" in scenario
    assert "instructions" in scenario


def test_practice_session_basic():
    """Test basic websocket connection and initial response"""
    client = TestClient(app)

    with client.websocket_connect("/api/practice?lang=ja") as websocket:
        # First get the scenario instructions
        scenarios_response = client.get("/api/scenarios")
        scenarios = [Scenario.model_validate(m) for m in scenarios_response.json()]
        scenario = next(s for s in scenarios if s.id == SCENARIO_ID)

        # Translate the instructions
        translate_response = client.post(
            "/api/translate", json={"text": scenario.instructions, "language": "ja"}
        )
        translated_text = translate_response.json()["transcription"]

        # Send the translated instructions
        message = TextWebSocketMessage(
            text=translated_text,
            role=MessageRole.USER
        )
        websocket.send_json(message.model_dump())

        # We should receive a response
        response = websocket.receive_text()
        assert response, "Should receive response"
        assert len(response) > 0, "Response should not be empty"

        # Test sending some audio data
        websocket.send_text(
            AudioWebSocketMessage(
                audio=base64.b64encode(b"dummy audio"),
                role=MessageRole.USER,
            ).model_dump_json()
        )
        response = websocket.receive_text()
        assert response, "Should receive response to audio input"


def test_practice_session_with_audio():
    """Test websocket connection with real audio file input"""
    client = TestClient(app)
    # Get path to test audio file
    audio_path = pathlib.Path(__file__).parent / "data" / "checkin.wav"

    with client.websocket_connect("/api/practice?lang=ja") as websocket:
        # First get the scenario instructions
        scenarios_response = client.get("/api/scenarios")
        scenarios = [Scenario.model_validate(m) for m in scenarios_response.json()]
        scenario = next(s for s in scenarios if s.id == SCENARIO_ID)

        # Translate the instructions
        translate_response = client.post(
            "/api/translate", json={"text": scenario.instructions, "language": "ja"}
        )
        translated_text = translate_response.json()["transcription"]

        # Send the translated instructions
        message = TextWebSocketMessage(
            text=translated_text,
            role=MessageRole.USER
        )
        websocket.send_json(message.model_dump())

        # Wait for response
        audio_pcm = []
        while True:
            msg = parse_websocket_message(json.loads(websocket.receive_text()))
            if msg.type == MessageType.AUDIO:
                audio_pcm.append(msg.audio)
            if msg.end_of_turn:
                break

        with wave.open("/tmp/initial_response.wav", "wb") as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(24000)
            f.writeframes(b"".join(audio_pcm))

        # Read the WAV file directly as raw PCM
        with open(audio_path, "rb") as f:
            # Skip WAV header (44 bytes)
            f.seek(44)
            raw_audio = f.read()

        print("Sending audio message")
        websocket.send_text(
            AudioWebSocketMessage(
                audio=base64.b64encode(raw_audio),
                role=MessageRole.USER,
            ).model_dump_json()
        )

        # send a text message to force end of turn
        print("Sending text message for end of turn")
        websocket.send_text(
            TextWebSocketMessage(
                text=".", 
                role=MessageRole.USER, 
                end_of_turn=True
            ).model_dump_json()
        )

        # Wait for response to audio
        second_response = []
        while True:
            msg = parse_websocket_message(json.loads(websocket.receive_text()))
            if msg.type == MessageType.AUDIO:
                print("Received audio...")
                second_response.append(msg.audio)
            else:
                print("Received message:", msg)

            if (
                msg.type == MessageType.AUDIO or msg.type == MessageType.TEXT
            ) and msg.end_of_turn:
                break

        with wave.open("/tmp/second_response.wav", "wb") as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(24000)
            f.writeframes(b"".join(second_response))


if __name__ == "__main__":
    test_practice_session_basic()
    test_practice_session_with_audio()
