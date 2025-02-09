import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from multivox.app import app, translate


def test_translate_api():
    """Test the translation API endpoint"""
    client = TestClient(app)
    
    response = client.post(
        "/api/translate",
        json={"text": "Hello, how are you?", "language": "ja"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "translation" in data
    assert isinstance(data["translation"], str)
    assert len(data["translation"]) > 0
    assert data["translation"] != "Hello, how are you?"


def test_translate_basic():
    """Test that translation to Japanese produces different output than input"""
    test_text = "Hello, how are you?"
    result = translate(test_text, "ja")
    
    assert result != test_text  # Translation should be different from input
    assert len(result) > 0  # Should get non-empty result
    assert isinstance(result, str)  # Should return string


def test_translate_invalid_language():
    """Test that invalid language code raises HTTPException"""
    test_text = "Hello"
    with pytest.raises(HTTPException) as exc_info:
        translate(test_text, "xx")  # xx is not a valid language code
    assert exc_info.value.status_code == 400
    assert "Unsupported language" in str(exc_info.value.detail)
