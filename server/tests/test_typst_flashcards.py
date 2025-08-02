import tempfile
from pathlib import Path

import pytest

from multivox.flashcards.generate_pdf_typst import (
    TypstPDFGeneratorConfig,
    create_flashcard_pdf_typst,
)
from multivox.flashcards.schema import RawFlashCard


@pytest.fixture
def sample_cards():
    """Sample flashcards for testing"""
    return [
        RawFlashCard(
            front="こんにちは",
            front_sub="konnichiwa", 
            front_context="日常の挨拶として使われます。",
            back="hello",
            back_context="Common daily greeting"
        ),
        RawFlashCard(
            front="ありがとう",
            front_sub="arigatou",
            front_context="感謝を表す言葉です。",
            back="thank you", 
            back_context="Expression of gratitude"
        ),
        RawFlashCard(
            front="すみません",
            front_sub="sumimasen",
            front_context="謝罪や呼びかけに使います。",
            back="excuse me / sorry",
            back_context="Used for apology or getting attention"
        ),
    ]




def test_pdf_generation(sample_cards):
    """Test PDF generation with sample cards"""
    with tempfile.TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "test_flashcards.pdf"
        
        config = TypstPDFGeneratorConfig(
            cards=sample_cards,
            output_path=output_path,
            columns=2,
            rows=2
        )
        
        create_flashcard_pdf_typst(config)
        assert output_path.exists()
        assert output_path.stat().st_size > 0


def test_pdf_generation_empty_cards():
    """Test PDF generation with empty cards list"""
    with tempfile.TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "empty_flashcards.pdf"
        
        config = TypstPDFGeneratorConfig(
            cards=[],
            output_path=output_path
        )
        
        create_flashcard_pdf_typst(config)
        assert output_path.exists()
        assert output_path.stat().st_size > 0