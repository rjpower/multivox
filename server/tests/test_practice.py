import base64
import json
import logging
import os
import pathlib
import wave

from fastapi.testclient import TestClient
from multivox.app import app
from multivox.scenarios import list_scenarios
from multivox.types import (
    AudioWebSocketMessage,
    InitializeWebSocketMessage,
    MessageRole,
    MessageType,
    Scenario,
    TextWebSocketMessage,
    TranslateResponse,
    parse_websocket_message,
    parse_websocket_message_bytes,
)

# Use a known scenario ID from the test data
SCENARIO_ID = [s for s in list_scenarios() if "hotel" in s.title.lower()][0].id

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

    # First get the scenario instructions
    scenarios_response = client.get("/api/scenarios")
    scenarios = [Scenario.model_validate(m) for m in scenarios_response.json()]
    scenario = next(s for s in scenarios if s.id == SCENARIO_ID)

    # Translate the instructions
    translate_response = client.post(
        "/api/translate?&api_key={os.environ['GEMINI_API_KEY']}",
        json={"text": scenario.instructions, "target_language": "ja"},
    )
    assert translate_response.status_code == 200, translate_response.text
    translation = TranslateResponse.model_validate_json(translate_response.text)

    with client.websocket_connect(
        f"/api/practice?target_language=ja&api_key={os.environ['GEMINI_API_KEY']}"
    ) as websocket:
        # Send initial message and wait for response
        logging.info("Sending initial message.")
        message = InitializeWebSocketMessage(
            text=translation.translation, role=MessageRole.USER, end_of_turn=True
        )
        websocket.send_text(message.model_dump_json())

        # Collect all responses until we get hints
        responses = []
        while True:
            response = websocket.receive_text()
            msg = parse_websocket_message_bytes(response)
            logging.info("Received message type: %s", msg.type)
            responses.append(msg)
            if msg.type == MessageType.HINT:
                break

        # Verify we got expected message types
        assert any(r.type == MessageType.TEXT for r in responses), "Should receive text response"
        assert any(r.type == MessageType.HINT for r in responses), "Should receive hints"


def test_practice_session_with_audio():
    """Test websocket connection with real audio file input"""
    client = TestClient(app)
    # Get path to test audio file
    audio_path = pathlib.Path(__file__).parent / "data" / "checkin.wav"
    # First get the scenario instructions
    scenarios_response = client.get("/api/scenarios")
    scenarios = [Scenario.model_validate(m) for m in scenarios_response.json()]
    scenario = next(s for s in scenarios if s.id == SCENARIO_ID)

    # Translate the instructions
    translate_response = client.post(
        f"/api/translate?api_key={os.environ['GEMINI_API_KEY']}", 
        json={"text": scenario.instructions, "target_language": "ja"}
    )
    assert translate_response.status_code == 200
    translation = TranslateResponse.model_validate_json(translate_response.text)

    with client.websocket_connect(
        f"/api/practice?target_language=ja&api_key={os.environ['GEMINI_API_KEY']}"
    ) as websocket:
        message = InitializeWebSocketMessage(
            text=translation.translation,
            role=MessageRole.USER,
            end_of_turn=True
        )
        websocket.send_text(message.model_dump_json())

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
                text=".", role=MessageRole.USER, end_of_turn=True
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


def _exchange_messages(websocket, message: str, is_initial: bool = False) -> tuple[list[str], list[str]]:
    """Helper function to send a message and collect responses and hints.
    Returns (text_responses, hints)"""
    if is_initial:
        message_obj = InitializeWebSocketMessage(
            text=message, role=MessageRole.USER, end_of_turn=True
        )
    else:
        message_obj = TextWebSocketMessage(
            text=message, role=MessageRole.USER, end_of_turn=True
        )
    websocket.send_text(message_obj.model_dump_json())

    text_responses = []
    hints = []
    while True:
        data = websocket.receive_text()
        resp = parse_websocket_message_bytes(data)
        print(f"Received response: {resp}")

        if resp.type == MessageType.TEXT:
            text_responses.append(resp.text)
        elif resp.type == MessageType.HINT:
            hints.extend(resp.hints)
            break

    return text_responses, hints

def test_simple_text_modality():
    """Test websocket connection with text-only modality"""
    client = TestClient(app)

    with client.websocket_connect(
        f"/api/practice?target_language=ja&modality=text&api_key={os.environ['GEMINI_API_KEY']}"
    ) as websocket:
        # Send initial message
        message = InitializeWebSocketMessage(
            text="おはようございます",
            role=MessageRole.USER,
            end_of_turn=True
        )
        websocket.send_text(message.model_dump_json())

        # Collect all responses until we get hints
        responses = []
        while True:
            response = websocket.receive_text()
            msg = parse_websocket_message_bytes(response)
            responses.append(msg)
            if msg.type == MessageType.HINT:
                break

        # Verify we got expected message types
        assert any(r.type == MessageType.TEXT for r in responses), "Should receive text response"
        assert any(r.type == MessageType.HINT for r in responses), "Should receive hints"

def test_hotel_checkin_conversation():
    """Test a full hotel check-in conversation flow in Japanese text modality"""
    client = TestClient(app)

    with client.websocket_connect(
        f"/api/practice?target_language=ja&modality=text&api_key={os.environ['GEMINI_API_KEY']}"
    ) as websocket:
        # Initial greeting
        responses, hints = _exchange_messages(
            websocket, "こんにちは。チェックインをお願いします。", is_initial=True
        )
        assert len(responses) > 0
        assert len(hints) > 0
        assert not any("hello" in r.lower() for r in responses), "Response should be in Japanese"

        # Provide reservation details
        responses, hints = _exchange_messages(websocket, "山田太郎の予約があります。")
        assert len(responses) > 0
        assert len(hints) > 0
        assert not any("name" in r.lower() for r in responses), "Response should be in Japanese"

        # Provide ID
        responses, hints = _exchange_messages(
            websocket, "はい、パスポートをお見せします。"
        )
        assert len(responses) > 0
        assert len(hints) > 0
        assert not any("passport" in r.lower() for r in responses), "Response should be in Japanese"

        # Final confirmation and key receipt
        responses, hints = _exchange_messages(
            websocket, "ありがとうございます。部屋は何階ですか？"
        )
        assert len(responses) > 0
        assert len(hints) > 0
        assert not any("floor" in r.lower() for r in responses), "Response should be in Japanese"
