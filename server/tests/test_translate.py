import os

import pytest
from fastapi.testclient import TestClient
from multivox.app import app, translate
from multivox.types import TranslateRequest, TranslateResponse


async def test_translate_basic():
    """Test that translation to Japanese produces different output than input"""
    test_text = "Hello, how are you?"
    result: TranslateResponse = await translate(
        TranslateRequest(
            text=test_text,
            source_language="en",
            target_language="ja",
        ),
    )
    print(result)

    assert (
        result.translated_text != test_text
    )  # Translation should be different from input
    assert (
        "こんにちは" in result.translated_text or "はい" in result.translated_text
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
                "api_key": os.environ["GEMINI_API_KEY"],
            },
        )


INSTRUCTIONS = """
You are a hotel clerk.
Check the customer, ask their name etc. etc.
"""


# Test data mapping languages to expected words in translation
TRANSLATION_TEST_CASES = [
    ("ja", ["あなた"]),
    ("es", ["gerente", "tienda", "cliente"]),
]


@pytest.mark.parametrize("lang_code,expected_words", TRANSLATION_TEST_CASES)
async def test_translate_long_instructions(lang_code: str, expected_words: list[str]):
    """Test translation of longer instructional text"""
    result = await translate(
        TranslateRequest(
            text=INSTRUCTIONS,
            source_language="en",
            target_language=lang_code,
        )
    )
    print(result)

    # Check the translation is non-empty and roughly proportional in length
    # (allowing for different language characteristics)
    assert len(result.translated_text) > len(INSTRUCTIONS) * 0.3
    assert len(result.translated_text) < len(INSTRUCTIONS) * 2.0

    # Check that obvious English terms are not present
    english_terms = ["teacher", "lesson", "instructions", "conversation"]
    for term in english_terms:
        assert term.lower() not in result.translated_text.lower()

    # Check for presence of language-specific words
    found_words = False
    for word in expected_words:
        if word in result.translated_text:
            found_words = True
            break
    assert (
        found_words
    ), f"Expected to find words like {expected_words} in {lang_code} translation"
