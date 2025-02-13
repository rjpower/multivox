import os

from fastapi.testclient import TestClient
from multivox.app import app
from multivox.types import HintOption, HintResponse


def test_hints_api():
    client = TestClient(app)

    # Make request
    response = client.post(
        "/api/hints",
        json={
            "history": "こんにちは",
            "language": "ja",
            "api_key": os.environ["GEMINI_API_KEY"],
        },
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
