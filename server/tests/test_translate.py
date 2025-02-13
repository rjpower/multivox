import os

import pytest
from fastapi.testclient import TestClient
from multivox.app import app, translate
from multivox.scenarios import list_scenarios
from multivox.types import LANGUAGES, TranslateResponse


def test_translate_api():
    """Test the translation API endpoint"""
    client = TestClient(app)

    response = client.post(
        "/api/translate",
        json={
            "text": "Hello, how are you?",
            "target_language": "ja",
            "source_language": "en",
        },
        params={"api_key": os.environ["GEMINI_API_KEY"]},
    )

    assert response.status_code == 200
    data = response.json()
    assert "translation" in data
    assert isinstance(data["translation"], str)
    assert len(data["translation"]) > 0
    assert data["translation"] != "Hello, how are you?"


async def test_translate_basic():
    """Test that translation to Japanese produces different output than input"""
    test_text = "Hello, how are you?"
    result: TranslateResponse = await translate(
        text=test_text,
        source_lang=LANGUAGES["en"],
        target_lang=LANGUAGES["ja"]
    )
    print(result)

    assert result.translation != test_text  # Translation should be different from input
    assert (
        "こんにちは" in result.translation or "はい" in result.translation
    )  # Should contain Japanese text


async def test_translate_invalid_language():
    """Test that invalid language code raises HTTPException"""
    client = TestClient(app)

    with pytest.raises(KeyError):
        client.post(
            "/api/translate",
            json={
                "text": "Hello, how are you?",
                "target_language": "xx",
                "source_language": "en",
            },
            params={"api_key": os.environ["GEMINI_API_KEY"]},
        )

INSTRUCTIONS = list_scenarios()[0].instructions


# Test data mapping languages to expected words in translation
TRANSLATION_TEST_CASES = [
    ("ja", ["あなた"]),
    ("es", ["gerente", "tienda", "cliente"]),
]

@pytest.mark.parametrize("lang_code,expected_words", TRANSLATION_TEST_CASES)
async def test_translate_long_instructions(lang_code: str, expected_words: list[str]):
    """Test translation of longer instructional text"""
    result = await translate(
        text=INSTRUCTIONS,
        source_lang=LANGUAGES["en"],
        target_lang=LANGUAGES[lang_code]
    )
    print(result)

    # Check the translation is non-empty and roughly proportional in length
    # (allowing for different language characteristics)
    assert len(result.translation) > len(INSTRUCTIONS) * 0.3
    assert len(result.translation) < len(INSTRUCTIONS) * 2.0

    # Check that obvious English terms are not present
    english_terms = ["teacher", "lesson", "instructions", "conversation"]
    for term in english_terms:
        assert term.lower() not in result.translation.lower()

    # Check for presence of language-specific words
    found_words = False
    for word in expected_words:
        if word in result.translation:
            found_words = True
            break
    assert found_words, f"Expected to find words like {expected_words} in {lang_code} translation"
