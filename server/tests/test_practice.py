import base64
import logging
import os
import pathlib
import queue
import threading
import time
import wave
from typing import Callable, List, Optional

from fastapi.testclient import TestClient
from multivox.app import app
from multivox.types import (
    AudioWebSocketMessage,
    InitializeWebSocketMessage,
    MessageRole,
    MessageType,
    TextWebSocketMessage,
    TranslateResponse,
    WebSocketMessage,
    parse_websocket_message_bytes,
)
from tests.test_translate import INSTRUCTIONS


class WebSocketPoller:
    """
    Helper class that collects messages from a websocket in a separate thread.
    The thread can be abandoned after a timeout.
    """

    def __init__(self, websocket):
        """Initialize the poller with a websocket connection."""
        self.websocket = websocket
        self.messages = []
        self.message_queue: queue.Queue = queue.Queue(maxsize=1)
        self.running = False
        self.thread = None

    def start(self):
        """Start collecting messages in a background thread."""
        if self.thread is not None:
            return

        self.running = True
        self.thread = threading.Thread(target=self._collect_messages)
        self.thread.daemon = True  # Thread will be killed when main thread exits
        self.thread.start()

    def stop(self):
        """Stop the message collection thread."""
        self.running = False
        if self.thread is not None:
            self.thread.join(0.1)  # Wait briefly for thread to exit
            self.thread = None

    def _collect_messages(self):
        """Thread function that collects messages from the websocket."""
        logging.info("Started collecting messages.")
        while self.running:
            try:
                # Receive message from websocket
                data = self.websocket.receive_text()
                msg = parse_websocket_message_bytes(data)

                self.message_queue.put(msg)

                logging.info(
                    f"{self.thread.ident} -- Received message type: {msg.type}"
                )

            except Exception as e:
                if self.running:  # Only log if we're still supposed to be running
                    logging.warning(f"Error receiving message: {e}")
                time.sleep(0.1)  # Prevent tight loop

    def get_messages(self):
        """Get all collected messages so far."""
        return self.messages.copy()

    def wait_for_condition(self, condition: Callable[[List[WebSocketMessage]], bool], timeout: float = 5.0):
        """
        Wait until the condition is met or timeout expires.
        
        Args:
            condition: Function that takes the list of messages and returns True when condition is met
            timeout: Maximum time to wait in seconds
            
        Returns:
            True if condition was met, False if timeout occurred
        """
        start_time = time.time()

        # Check if condition is already met with current messages
        if condition(self.messages):
            return True

        # Wait for more messages until condition is met or timeout
        while time.time() - start_time < timeout:
            try:
                # Wait for a new message with timeout
                msg = self.message_queue.get(timeout=0.1)
                self.messages.append(msg)

                # Check if condition is now met
                if condition(self.messages):
                    return True

            except queue.Empty:
                # No new message, continue waiting
                pass

        return False


def poll_for_messages(
    websocket,
    condition: Optional[Callable[[List[WebSocketMessage]], bool]] = None,
    timeout: float = 5.0
) -> List[WebSocketMessage]:
    """
    Poll for websocket messages with a timeout using a background thread.
    
    Args:
        websocket: The websocket connection
        condition: Optional function that takes the list of collected messages and returns 
                  True when we've collected enough messages (e.g., have audio, text, and hints)
        timeout: Maximum time to wait in seconds
        
    Returns:
        List of all received messages within the timeout period
    """
    # Create and start the poller
    poller = WebSocketPoller(websocket)
    poller.start()
    
    try:
        # Wait for condition or timeout
        if condition is not None:
            poller.wait_for_condition(condition, timeout)
        else:
            # If no condition, just wait for the timeout
            time.sleep(timeout)
            
        # Return all collected messages
        return poller.get_messages()
        
    finally:
        # Always stop the poller thread
        poller.stop()


def _translate_instructions(client: TestClient, text: str, target_language: str, api_key: Optional[str] = None) -> str:
    """Helper function to translate text using the API"""
    api_key = api_key or os.environ["GEMINI_API_KEY"]
    translate_response = client.post(
        "/api/translate",
        json={
            "text": text,
            "source_language": "en",
            "target_language": target_language,
        },
    )
    assert translate_response.status_code == 200, translate_response.text
    translation = TranslateResponse.model_validate_json(translate_response.text)
    return translation.translated_text

"""
You are a hotel clerk at the Fancy Pants Hotel.
Check in the guest.
"""

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


def test_audio_modality():
    """Test basic websocket connection and initial response"""
    client = TestClient(app)

    translation = _translate_instructions(client, INSTRUCTIONS, "ja")

    with client.websocket_connect(
        "/api/practice?practice_language=ja&native_language=en&native_language=en&modality=audio"
    ) as websocket:
        # Send initial message and wait for response
        logging.info("Sending initial message.")
        message = InitializeWebSocketMessage(
            text=translation, role=MessageRole.USER, end_of_turn=True
        )
        websocket.send_text(message.model_dump_json())

        # Define a condition that checks if we have all required message types
        def has_all_required_messages(messages):
            has_audio = any(m.type == MessageType.AUDIO for m in messages)
            has_transcription = any(m.type == MessageType.TRANSCRIPTION for m in messages)
            has_hint = any(m.type == MessageType.HINT for m in messages)
            return has_audio and has_transcription and has_hint

        # Poll for messages until we have all required types or timeout
        responses = poll_for_messages(
            websocket, condition=has_all_required_messages, timeout=10.0
        )

        # Log all received messages
        logging.info(f"Received {len(responses)} messages")

        # Filter responses by type
        audio_responses = [r for r in responses if r.type == MessageType.AUDIO]
        transcription_responses = [r for r in responses if r.type == MessageType.TRANSCRIPTION]
        hint_responses = [r for r in responses if r.type == MessageType.HINT]

        # Verify we got expected message types
        assert len(audio_responses) > 0, "Should receive audio response"
        assert len(transcription_responses) > 0, "Should receive text response"
        assert len(hint_responses) > 0, "Should receive hints"


def test_audio_input():
    """Test websocket connection with real audio file input"""
    client = TestClient(app)
    # Get path to test audio file
    audio_path = pathlib.Path(__file__).parent / "data" / "checkin.wav"
    translated_instructions = _translate_instructions(client, INSTRUCTIONS, "ja")

    with client.websocket_connect(
        "/api/practice?practice_language=ja&native_language=en&native_language=en"
    ) as websocket:
        message = InitializeWebSocketMessage(
            text=translated_instructions,
            role=MessageRole.USER,
            end_of_turn=True
        )
        websocket.send_text(message.model_dump_json())

        # Poll for initial response with audio
        def has_audio(messages):
            return any(m.type == MessageType.AUDIO for m in messages)
            
        responses = poll_for_messages(
            websocket,
            condition=has_audio,
            timeout=5.0
        )
        
        # Extract audio from responses
        audio_pcm = []
        for msg in responses:
            if msg.type == MessageType.AUDIO:
                audio_pcm.append(msg.audio)

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
                audio=base64.b64encode(raw_audio).decode('ascii'),
                mime_type="audio/pcm;rate=16000",
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

        # Poll for second response with audio
        second_responses = poll_for_messages(
            websocket,
            condition=has_audio,
            timeout=5.0
        )
        
        # Extract audio from second responses
        second_response = []
        for msg in second_responses:
            if msg.type == MessageType.AUDIO:
                print("Received audio...")
                second_response.append(msg.audio)

        with wave.open("/tmp/second_response.wav", "wb") as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(24000)
            f.writeframes(b"".join(second_response))


def _exchange_messages(
    websocket, message: str, timeout: float = 5.0
) -> List[WebSocketMessage]:
    """Helper function to send a message and collect responses and hints.
    Returns (text_responses)"""
    message_obj: WebSocketMessage | None = None

    message_obj = TextWebSocketMessage(
        text=message, role=MessageRole.USER, end_of_turn=True
    )
    websocket.send_text(message_obj.model_dump_json())

    # Define a condition that checks if we have both text and hint messages
    def has_text_and_hints(messages):
        has_text = any(m.type == MessageType.TEXT for m in messages)
        has_hint = any(m.type == MessageType.HINT for m in messages)
        has_done = any(
            m.type == MessageType.PROCESSING and m.status == "done" for m in messages
        )
        return has_text and has_hint and has_done

    # Poll for messages until we have both text and hints or timeout
    responses = poll_for_messages(
        websocket,
        condition=has_text_and_hints,
        timeout=timeout
    )
    return responses


def test_text_modality():
    """Test websocket connection with text-only modality"""
    client = TestClient(app)

    with client.websocket_connect(
        f"/api/practice?practice_language=ja&native_language=en&modality=text&api_key={os.environ['GEMINI_API_KEY']}"
    ) as websocket:
        # Send initial message
        message = InitializeWebSocketMessage(
            text="おはようございます",
            role=MessageRole.USER,
            end_of_turn=True
        )
        websocket.send_text(message.model_dump_json())

        # Define a condition that checks if we have both transcription and hint messages
        def has_transcription_and_hints(messages):
            has_transcription = any(m.type == MessageType.TRANSCRIPTION for m in messages)
            has_hint = any(m.type == MessageType.HINT for m in messages)
            return has_transcription and has_hint

        # Poll for messages until we have both transcription and hints or timeout
        responses = poll_for_messages(
            websocket,
            condition=has_transcription_and_hints,
            timeout=5.0
        )

        # Filter responses by type
        transcription_responses = [r for r in responses if r.type == MessageType.TRANSCRIPTION]
        hint_responses = [r for r in responses if r.type == MessageType.HINT]

        # Verify we got expected message types
        assert len(transcription_responses) > 0, "Should receive transcription response"
        assert len(hint_responses) > 0, "Should receive hints"


def test_hotel_checkin_conversation():
    """Test a full hotel check-in conversation flow in Japanese text modality"""
    client = TestClient(app)

    with client.websocket_connect(
        "/api/practice?practice_language=ja&native_language=en&modality=text",
    ) as websocket:
        message = InitializeWebSocketMessage(
            text="あなたはホテルの店員です。お客様が到着しました。",
            role=MessageRole.USER,
            end_of_turn=True,
        )
        websocket.send_text(message.model_dump_json())

        responses = _exchange_messages(
            websocket,
            "こんにちは。チェックインをお願いします。",
        )
        assert len(responses) > 0

        responses = _exchange_messages(websocket, "山田太郎の予約があります。")
        assert len(responses) > 0

        responses = _exchange_messages(websocket, "はい、パスポートをお見せします。")
        assert len(responses) > 0

        responses = _exchange_messages(
            websocket, "ありがとうございます。部屋は何階ですか？"
        )
        assert len(responses) > 0
