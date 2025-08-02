import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import List, Sequence

import typst

from multivox.flashcards.schema import FlashCard


@dataclass
class TypstPDFGeneratorConfig:
    """Configuration for Typst PDF generation"""

    cards: Sequence[FlashCard]
    output_path: Path
    columns: int = 3
    rows: int = 8


def generate_typst_content(cards: Sequence[FlashCard], columns: int, rows: int) -> str:
    """Generate Typst content for flashcards"""
    template_path = Path(__file__).parent / "flashcard_template.typ"
    
    # Read template content and include it directly
    template_content = template_path.read_text(encoding='utf-8')
    content = [template_content, ""]
    
    # Generate cards data
    content.append("#let cards = (")
    for card in cards:
        # Escape quotes and handle None values
        front = card.front.replace('"', '\\"') if card.front else ""
        front_sub = card.front_sub.replace('"', '\\"') if card.front_sub else ""
        front_context = card.front_context.replace('"', '\\"') if card.front_context else ""
        back = card.back.replace('"', '\\"') if card.back else ""
        back_context = card.back_context.replace('"', '\\"') if card.back_context else ""
        
        content.append(f'  (front: "{front}", front_sub: "{front_sub}", front_context: "{front_context}", back: "{back}", back_context: "{back_context}"),')
    
    content.append(")")
    content.append("")
    
    # Generate flashcards
    content.append(f"#generate-flashcards(cards, columns: {columns}, rows: {rows})")
    
    return "\n".join(content)


def create_flashcard_pdf_typst(config: TypstPDFGeneratorConfig) -> None:
    """Generate PDF with flashcards using Typst Python API"""
    # Generate Typst content
    typst_content = generate_typst_content(config.cards, config.columns, config.rows)
    
    # Create temporary file for Typst source
    with tempfile.NamedTemporaryFile(mode='w', suffix='.typ', delete=False, encoding='utf-8') as temp_file:
        temp_file.write(typst_content)
        temp_file_path = temp_file.name
    
    try:
        # Compile with Typst Python API
        pdf_bytes = typst.compile(temp_file_path)
        
        # Write PDF to output path
        config.output_path.write_bytes(pdf_bytes)
        
    except Exception as e:
        raise RuntimeError(f"Typst compilation failed: {e}")
    finally:
        # Clean up temporary file
        Path(temp_file_path).unlink(missing_ok=True)


def batch_cards(cards: Sequence[FlashCard], batch_size: int) -> List[List[FlashCard]]:
    """Split cards into batches of specified size"""
    return [list(cards[i : i + batch_size]) for i in range(0, len(cards), batch_size)]