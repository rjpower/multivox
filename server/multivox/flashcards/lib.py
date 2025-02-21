import io
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Optional, Sequence

import pandas as pd
import pysrt
from multivox.cache import cached_completion
from multivox.flashcards.generate_anki import (
    create_anki_package,
    generate_audio_for_cards,
)
from multivox.flashcards.generate_pdf import PDFGeneratorConfig, create_flashcard_pdf
from multivox.flashcards.schema import (
    OutputFormat,
    ProgressLogger,
    SourceMapping,
    VocabItem,
)
from multivox.types import Language
from pydantic import BaseModel


class SRTProcessConfig(BaseModel):
    srt_path: Path
    output_path: Path
    output_format: str
    source_language: Language
    target_language: Language
    include_audio: bool = False
    deck_name: Optional[str] = None
    ignore_words: set[str] = set()
    progress_logger: ProgressLogger
    block_size: int = 25


class CSVProcessConfig(BaseModel):

    class Config:
        arbitrary_types_allowed = True

    df: pd.DataFrame
    output_path: Path
    output_format: str
    source_language: Language
    target_language: Language
    include_audio: bool = False
    deck_name: Optional[str] = None
    field_mapping: SourceMapping
    ignore_words: set[str] = set()
    progress_logger: ProgressLogger


def load_csv_items(
    df: pd.DataFrame,
    mapping: SourceMapping,
) -> List[VocabItem]:
    """Load vocabulary items from a DataFrame using the specified field mapping

    Args:
        df: Pandas DataFrame containing vocabulary data
        mapping: Field mapping configuration
        chunk_size: Number of items to process in each LLM batch

    Returns:
        List of validated vocabulary items with inferred fields
    """
    logging.debug("Processing DataFrame with %d rows", len(df))
    rows = []
    for i, row in df.iterrows():
        item_data = {
            "term": row.get(mapping.term, "") if mapping.term else "",
            "reading": row.get(mapping.reading, "") if mapping.reading else "",
            "meaning": row.get(mapping.meaning, "") if mapping.meaning else "",
            "context_native": (
                row.get(mapping.context_native) if mapping.context_native else ""
            ),
            "context_en": row.get(mapping.context_en) if mapping.context_en else "",
            "source": "csv_import",
        }

        # Only add items that have at least one non-empty main field
        if any([item_data["term"], item_data["reading"], item_data["meaning"]]):
            item = VocabItem.model_validate(item_data)
            rows.append(item)
    return rows


def _infer_missing_fields_chunk(
    chunk: Sequence[VocabItem],
    progress_logger: ProgressLogger = logging.info,
) -> List[VocabItem]:
    """Process a chunk of DataFrame rows into vocabulary items"""
    complete_records = [
        item
        for item in chunk
        if item.term
        and item.reading
        and item.meaning
        and item.context_native
        and item.context_en
    ]
    incomplete_records = [item for item in chunk if item not in complete_records]

    if not incomplete_records:
        return complete_records

    progress_logger(
        f"Inferring missing fields for {len(incomplete_records)} incomplete records"
    )

    items_data = [item.model_dump(exclude_unset=False) for item in incomplete_records]

    prompt = f"""Given these vocabulary items, infer missing fields.

Fields:

- term: the native language term
- reading: the phonetic reading of the term if relevant -- use Hiragana or Katakana for Japanese, Pinyin for Chinese.
- meaning: meaning of the term in English, if multiple meanings are common, separate with commas
- context_native: a sentence in the native language using `term`. 
  this should be a simple sentence, but one that displays natural grammar.
  for Chinese and Japanese, use Ruby annotations for word pronunciation in the appropriate format (e.g. Hiragana, Katakana, Pinyin).
- context_en: English translation of the example sentence.

Example output:
[
  {{
      "term": "図書館",
      "reading": "としょかん",
      "meaning": "library",
      "context_native": "<ruby>図書館<rt>としょかん</rt>から<ruby>本<rt>ほん</rt></ruby>を<ruby>借<rt>か</rt></ruby>りました。",
      "context_en": "I borrowed a book from the library."
  }},
  {{
      "term": "病院",
      "reading": "びょういん",
      "meaning": "hospital",
      "context_native": "<ruby>病院<rt>びょういん</rt></ruby>に行きました。",
      "context_en": "I went to the hospital."
  }}
]

Inputs:
{json.dumps(items_data, ensure_ascii=False, sort_keys=True)}

Return only valid JSON array with complete items in same format."""

    completed_items = json.loads(
        cached_completion(
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
    )

    assert isinstance(completed_items, list), completed_items

    for item in completed_items:
        try:
            VocabItem.model_validate(item)
        except Exception as e:
            progress_logger(f"Failed to validate item: {str(e)}, {item}")

    return complete_records + [
        VocabItem.model_validate(item) for item in completed_items
    ]


def infer_missing_fields(
    rows: Sequence[VocabItem],
    progress_logger: ProgressLogger = logging.info,
    infer_chunk_size: int = 25,
):
    """Process vocabulary items in parallel chunks with progress tracking"""
    # Split into chunks
    chunks = [
        rows[i : i + infer_chunk_size] for i in range(0, len(rows), infer_chunk_size)
    ]
    total = len(chunks)
    completed = 0
    all_results = []

    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_chunk = {
            executor.submit(_infer_missing_fields_chunk, chunk, progress_logger): chunk
            for chunk in chunks
        }

        # Process completed chunks as they finish
        for future in as_completed(future_to_chunk):
            completed += 1
            progress_logger(
                f"Processed chunk {completed}/{total} ({completed/total*100:.1f}%)"
            )

            try:
                chunk_results = future.result()
                all_results.extend(chunk_results)
            except Exception as e:
                progress_logger(f"Error processing chunk: {str(e)}")

    return all_results


def process_srt(config: SRTProcessConfig):
    """Process SRT file to generate flashcards"""
    config.progress_logger("Extracting text from SRT")
    text_blocks = extract_text_from_srt(config.srt_path)

    config.progress_logger("Analyzing vocabulary")
    vocab_items = analyze_vocabulary(text_blocks, config)
    vocab_items = remove_duplicate_terms(vocab_items)

    audio_mapping = {}
    if config.include_audio:
        config.progress_logger("Generating audio files")
        audio_mapping = generate_audio_for_cards(
            vocab_items, language=config.target_language, logger=config.progress_logger
        )

    config.progress_logger(f"Exporting to {config.output_format}")

    if config.output_format == OutputFormat.ANKI_PKG:
        create_anki_package(
            config.output_path,
            vocab_items,
            config.deck_name or clean_filename(config.srt_path.name),
            audio_mapping=audio_mapping,
            target_language=config.target_language,
            logger=config.progress_logger,
        )
    else:
        gen_config = PDFGeneratorConfig(
            cards=vocab_items,
            output_path=config.output_path,
        )
        create_flashcard_pdf(gen_config)


def process_csv(config: CSVProcessConfig):
    """Process CSV file to generate flashcards."""
    config.progress_logger("Loading CSV data")

    vocab_items = load_csv_items(config.df, config.field_mapping)
    config.progress_logger(f"Loaded {len(vocab_items)} vocabulary items")
    vocab_items = infer_missing_fields(vocab_items, config.progress_logger)
    config.progress_logger(f"{len(vocab_items)} vocabulary items after inference.")
    vocab_items = remove_duplicate_terms(vocab_items)
    config.progress_logger(
        f"{len(vocab_items)} vocabulary items after filtering and dedup."
    )

    if config.include_audio:
        audio_mapping = generate_audio_for_cards(
            vocab_items, language=config.target_language, logger=config.progress_logger
        )
    else:
        audio_mapping = {}

    # Export based on format
    config.progress_logger(f"Exporting to {config.output_format}")

    if config.output_format == OutputFormat.ANKI_PKG:
        create_anki_package(
            config.output_path,
            vocab_items,
            config.deck_name or "csv_import_deck",
            audio_mapping=audio_mapping,
            target_language=config.target_language,
        )
    else:
        gen_config = PDFGeneratorConfig(
            cards=vocab_items,
            output_path=config.output_path,
        )
        create_flashcard_pdf(gen_config)


def extract_text_from_srt(srt_path: Path) -> List[str]:
    """Extract all text from SRT file, combining consecutive subtitles"""
    subs = pysrt.open(srt_path)
    text_blocks = []

    for sub in subs:
        clean_text = re.sub(r"<[^>]+>", "", sub.text)
        text_blocks.append(clean_text)

    return text_blocks


def analyze_srt_section(text: str, source_lang: Language, target_lang: Language) -> List[VocabItem]:
    prompt = f"""Extract vocabulary items from the following {source_lang.name} text.
For each vocabulary item, find an actual example sentence from the provided text that uses it.
Return a JSON array of objects with these fields:

* term: The {source_lang.name} term
* reading: The reading/pronunciation of the term (e.g. Hiragana/Katakana for Japanese, Pinyin for Chinese)
* meaning: The {target_lang.name} meaning of the term
* context_native: A {source_lang.name} sentence using the term in context
* context_en: The {target_lang.name} translation of the sentence

[
{{
"term": "獣医",
"reading": "じゅうい",
"meaning": "Veterinarian",
"context_native": "<ruby>医者<rt>いしゃ</rt></ruby>より<ruby>獣医<rt>じゅうい</rt></ruby>になりたい",
"context_en": "I want to become a veterinarian rather than a doctor",
}},
{{
"term": "病院",
"reading": "びょういん",
"meaning": "Hospital",
"context_native": "<ruby>病院<rt>びょういん</rt></ruby>に行く",
"context_en": "Go to the hospital",
}}
]

If you don't have a value for the field, omit the field entirely, e.g. if there's
no context to provide, don't include the context fields:

{{
"term": "こんにちは
"meaning": "Good Afternoon, Good Day, Hello",
}}

Text to analyze:
{text}

Return only valid JSON, no other text."""

    chunk_results = json.loads(
        cached_completion(
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
    )
    results = []
    for row in chunk_results:
        try:
            results.append(VocabItem.model_validate(row))
        except Exception as e:
            logging.error("Failed to validate vocab item: %s, %s %s", str(e), row)
            assert False
    return results


def analyze_vocabulary(text_blocks: List[str], config: SRTProcessConfig):
    """Submit text to LLM for vocabulary analysis with caching"""
    config.progress_logger("Starting vocabulary analysis")

    all_results = []
    num_chunks = len(text_blocks) // config.block_size + 1

    for i in range(0, len(text_blocks), config.block_size):
        text = "\n".join(text_blocks[i : i + config.block_size])
        current_chunk = i // config.block_size + 1
        chunk_results = analyze_srt_section(text, config.source_language, config.target_language)

        config.progress_logger(f"Processing chunk {current_chunk}/{num_chunks}")
        all_results.extend(chunk_results)

    config.progress_logger("Vocabulary analysis complete")
    return all_results


def remove_duplicate_terms(vocab_items: List[VocabItem]) -> List[VocabItem]:
    """Remove items with duplicate terms, keeping the first occurrence"""
    seen_terms = set()
    unique_items = []

    for item in vocab_items:
        if item.term not in seen_terms:
            seen_terms.add(item.term)
            unique_items.append(item)

    return unique_items


def clean_filename(filename: str) -> str:
    """Convert filename to clean format with dashes instead of spaces/special chars"""
    filename = Path(filename).stem
    cleaned = re.sub(r"[^.\w\s-]", "", filename)
    cleaned = re.sub(r"[-\s]+", "-", cleaned).strip()
    return cleaned.lower()


def read_csv(file_content: str) -> tuple[str, pd.DataFrame]:
    """Analyze CSV structure and return separator, column letters, and preview rows"""
    separators = [",", "\t", ";"]

    # Find best separator by trying each
    best_separator = ","
    max_columns = 0
    for sep in separators:
        try:
            df = pd.read_csv(io.StringIO(file_content), sep=sep, nrows=1, dtype=str)
            if len(df.columns) > max_columns:
                max_columns = len(df.columns)
                best_separator = sep
        except Exception:
            logging.debug("Failed to read CSV with separator: %s", sep)
            continue

    # Read preview with best separator
    df = pd.read_csv(io.StringIO(file_content), sep=best_separator, dtype=str)

    # Generate column letters (A, B, C, etc.)
    num_cols = len(df.columns)
    col_letters = [chr(65 + i) for i in range(num_cols)]  # A=65 in ASCII

    df.columns = col_letters

    return best_separator, df


def infer_field_mapping(df: pd.DataFrame, source_language: Language, target_language: Language) -> dict:
    """Get LLM suggestions for CSV field mapping using column letters"""
    logging.debug("Inferring field mapping for CSV data")
    preview_rows = df.head(25).fillna("").astype(str).values.tolist()
    sample_data = "\n".join(
        [",".join(df.columns), *[",".join(row) for row in preview_rows]]
    )

    prompt = f"""Analyze this CSV data and suggest mappings for a vocabulary flashcard system.
The system has the following fields:

* term: the {source_language.name} word or phrase
* reading: the pronunciation of the term, e.g. Hiragana or Katakana for Japanese, Pinyin for Chinese, etc.
* meaning: the {target_language.name} translation of the term
* context_native: a {source_language.name} sentence using the term
* context_en: the {target_language.name} translation of the sentence

One of "term" or "meaning" is mandatory. "term" must be a {source_language.name} word or phrase.  "meaning" must be a {target_language.name} word or phrase.
If you don't have a value for a field, leave it blank.

The columns are labeled with letters (A, B, C, etc.).
Look at the content in each column to suggest the best mapping.

CSV Data (first few rows):
{sample_data}


Return only valid JSON in this format:
{{
    "suggested_mapping": {{
        "term": "A",
        "reading": "B",
        "meaning": "C",
        "context_native": "D" or null,
        "context_en": "E" or null,
    }},
    "confidence": "high|medium|low",
    "reasoning": "Brief explanation of why each column was mapped based on its content"
}}"""

    return json.loads(
        cached_completion(
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
    )
