import asyncio
import base64
import http
import os
import wave
from pathlib import Path

import pytest
from google import genai
from google.genai import types as genai_types
from multivox.app import MessageBuffer, StreamingTranscriptionTask
from multivox.config import settings
from multivox.transcription import (
    streaming_transcription_config,
)
from multivox.types import (
    LANGUAGES,
    AudioWebSocketMessage,
    ChatMessage,
    MessageRole,
    MessageType,
    TextWebSocketMessage,
    TranscriptionWebSocketMessage,
)


class TestState:
    """Real chat state for testing"""
    def __init__(self):
        self.message_queue = asyncio.Queue()
        self.history = []

    async def handle_message(self, message):
        self.history.append(message)


@pytest.mark.asyncio
async def test_streaming_transcription_task():
    """Test StreamingTranscriptionTask with real Gemini API"""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        pytest.skip("GEMINI_API_KEY not set")

    language = LANGUAGES["ja"]
    client = genai.Client(
        api_key=api_key,
        http_options={
            "api_version": settings.GEMINI_API_VERSION,
        },
    )

    # Load test audio file
    test_audio_path = Path(__file__).parent / "data" / "checkin.wav"
    with wave.open(str(test_audio_path), 'rb') as wav:
        test_audio = wav.readframes(wav.getnframes())

    state = TestState()

    # Create and start task
    task = StreamingTranscriptionTask(state, language, client)
    tasks = await task.start()

    try:
        # Send test audio through both queues
        await state.message_queue.put(
            TextWebSocketMessage(role=MessageRole.ASSISTANT, text="こんにちは!")
        )

        await state.message_queue.put(
            AudioWebSocketMessage(
                audio=base64.b64encode(test_audio),
                role=MessageRole.USER,
                end_of_turn=True,
            )
        )

        await state.message_queue.put(
            TextWebSocketMessage(
                role=MessageRole.ASSISTANT,
                text="はい、かしこまりました！ チェーくいんのお手伝いをします。",
                end_of_turn=True,
            )
        )

        # Let the API process the audio
        await asyncio.sleep(10)

        # Verify we got responses
        transcription_messages = [
            m for m in state.history if isinstance(m, TranscriptionWebSocketMessage)
        ]
        assert len(transcription_messages) > 0

        # Verify transcription content
        first_transcription = transcription_messages[0]
        assert first_transcription.transcription.transcription
        assert first_transcription.transcription.translation
        assert first_transcription.transcription.dictionary
        assert first_transcription.transcription.chunked

        # Verify hint generation
        hint_messages = [m for m in state.history if m.type == MessageType.HINT]
        assert len(hint_messages) > 0
        assert hint_messages[0].hints

    finally:
        # Clean up
        task.stop()
        for t in tasks:
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass
