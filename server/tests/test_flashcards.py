import json

import pytest
from fastapi.testclient import TestClient
from multivox.app import app
from multivox.config import settings

client = TestClient(app)


@pytest.fixture
def basic_vocab_request():
    return {
        "content": "山\n空\n本\n猫\n水\n木\n花\n月\n雨\n風\n時\n道\n海\n手\n目\n耳\n口\n足\n頭\n心\n",
        "format": "apkg",
        "include_audio": True,
        "target_language": "ja",
        "mode": "csv",
        "field_mapping": {
            "term": "A",
            "reading": "",
            "meaning": "",
            "context_native": "",
            "context_en": "",
        },
    }


async def test_generate_flashcards_apkg(basic_vocab_request):
    """Test generating Anki flashcards from basic vocabulary list"""
    with client.websocket_connect("/api/flashcards/generate") as websocket:
        # Send request
        websocket.send_text(json.dumps(basic_vocab_request))

        # Process messages until we get success or error
        messages = []
        while True:
            msg = json.loads(websocket.receive_text())
            print(msg)
            messages.append(msg)
            if msg["type"] in ("success", "error"):
                break

        # Verify success
        assert messages[-1]["type"] == "success"
        assert "url" in messages[-1]
        assert messages[-1]["url"].endswith(".apkg")

        # Verify progress messages
        progress_msgs = [m for m in messages if m["type"] == "info"]
        assert len(progress_msgs) > 0
        assert any("Processing complete" in m["text"] for m in messages)

        # Verify the file exists
        download_path = messages[-1]["url"].replace("/downloads/", "")
        download_path = settings.DOWNLOAD_DIR / download_path
        assert download_path.exists()
        assert download_path.stat().st_size > 0
