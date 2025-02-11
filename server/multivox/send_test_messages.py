import asyncio

from multivox.message_socket import TypedWebSocket
from multivox.types import (
    DictionaryEntry,
    MessageRole,
    MessageType,
    TextWebSocketMessage,
    TranscribeResponse,
    TranscriptionWebSocketMessage,
)


async def send_test_messages(websocket: TypedWebSocket):
    """Send a series of test messages to the client"""
    test_messages = [
        TextWebSocketMessage(
            text="Hello! Let's practice some conversations.",
            role=MessageRole.ASSISTANT,
            end_of_turn=True,
        ),
        TranscriptionWebSocketMessage(
            transcription=TranscribeResponse(
                transcription="こんにちは、元気ですか？",
                chunked=["こんにちは、", "元気", "ですか？"],
                dictionary={
                    "こんにちは": DictionaryEntry(
                        native="こんにちは", english="Hello", notes="Formal greeting"
                    ),
                    "元気": DictionaryEntry(
                        native="元気",
                        english="Well/healthy",
                        notes="Common greeting term",
                    ),
                },
                translation="Hello, how are you?",
            ),
            role=MessageRole.ASSISTANT,
        ),
        TextWebSocketMessage(
            text="Try responding to my greeting!",
            role=MessageRole.ASSISTANT,
        ),
        TranscriptionWebSocketMessage(
            type=MessageType.TRANSCRIPTION,
            transcription=TranscribeResponse(
                transcription="はい、私は元気です。",
                chunked=["はい、", "私は", "元気です。"],
                dictionary={
                    "はい": DictionaryEntry(
                        native="はい", english="Yes", notes="Polite affirmative"
                    ),
                    "元気": DictionaryEntry(
                        native="元気",
                        english="Well/healthy",
                        notes="Common greeting term",
                    ),
                },
                translation="Yes, I am well.",
            ),
            role=MessageRole.USER,
        ),
    ]

    for message in test_messages:
        await websocket.send_message(message)
        await asyncio.sleep(1)  # Wait 1 second between messages