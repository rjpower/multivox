import hashlib
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Sequence

import genanki
from multivox.flashcards.schema import FlashCard, VocabItem
from multivox.tts import TTSAudio, generate_tts_audio_sync
from multivox.types import LANGUAGES, Language

# Fixed Model IDs
DEFAULT_MODEL_ID = 1607392319


def _id_from_name(name: str) -> int:
    # Use first 8 chars of md5 as hex, convert to int
    return int(hashlib.md5(name.encode()).hexdigest()[:8], 16)


ANKI_CARD_CSS = """
.card {
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic Pro", "Yu Gothic", Meiryo, sans-serif;
    font-size: 24px;
    text-align: center;
    color: #2c3e50;
    background-color: #f8f9fa;
    max-width: 800px;
    margin: 20px auto;
    padding: 20px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    border-radius: 8px;
}
.term {
    font-size: 32px;
    color: #2c3e50;
    margin-bottom: 15px;
    font-weight: bold;
}
.reading {
    font-size: 20px;
    color: #666;
    margin: 15px 0;
    font-family: "Hiragino Sans", sans-serif;
}
.meaning {
    font-size: 22px;
    color: #34495e;
    margin: 15px 0;
    padding: 10px;
    background-color: #e9ecef;
    border-radius: 5px;
}
ruby {
    font-size: 20px;
}
rt {
    font-size: 12px;
    color: #666;
}
hr#answer {
    border: none;
    border-top: 2px solid #dee2e6;
    margin: 20px 0;
}
.example {
    font-size: 18px;
    color: #495057;
    margin: 15px 0;
    line-height: 1.6;
    padding: 15px;
    background-color: #fff;
    border-left: 4px solid #4CAF50;
    border-radius: 4px;
}
.example-translation {
    font-size: 16px;
    color: #666;
    font-style: italic;
    margin: 10px 0;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 4px;
}
"""


@dataclass
class AudioModel:
    language_code: str
    model_name: str


# we might include audio for back & context later
@dataclass
class AudioData:
    term: str
    data: bytes


def generate_audio_for_cards(
    items: Sequence[FlashCard],
    language: Language,
    logger: Callable[[str], None],
    max_workers: int = 16,
) -> dict[str, AudioData]:
    """Generate audio for cards using parallel processing"""
    audio_mapping = {}
    # Create a list of all terms we need to generate audio for
    items_to_process = []
    for item in items:
        if item.front:
            items_to_process.append(
                (language, item.front_sub if item.front_sub else item.front)
            )
        if item.back:
            items_to_process.append((LANGUAGES["en"], item.back))

    total = len(items_to_process)
    completed = 0

    # Process items with thread pool
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {}
        for lang, term in items_to_process:
            future = executor.submit(generate_tts_audio_sync, lang, term)
            futures[term] = future

        # Process results as they complete
        for term, future in futures.items():
            try:
                tts_audio: TTSAudio = future.result()
                completed += 1
                logger(
                    f"Generated audio {tts_audio.text} -- {completed}/{total} ({completed/total*100:.1f}%)"
                )
                if tts_audio.data:
                    audio_mapping[term] = AudioData(tts_audio.text, tts_audio.data)
            except Exception as e:
                logger(f"Error generating audio for {term}: {e}")

    logger(f"Completed audio generation for {completed} terms")
    return audio_mapping


def create_anki_package(
    output_path: Path,
    vocab_items: List[VocabItem],
    deck_name: str,
    audio_mapping: dict[str, AudioData],
    target_language: Language,
    source_language: Language = LANGUAGES["en"],
    logger: Callable[[str], None] = print,
) -> genanki.Package:
    # Initialize models with fixed IDs
    default_model = genanki.Model(
        DEFAULT_MODEL_ID,
        f"{target_language} Vocabulary",
        fields=[
            {"name": "Term"},
            {"name": "Reading"},
            {"name": "Meaning"},
            {"name": "Example"},
            {"name": "ExampleTranslation"},
            {"name": "TermAudio"},
            {"name": "MeaningAudio"},
        ],
        templates=[
            {
                "name": f"{target_language} to {source_language}",
                "qfmt": """
                    <div class="term">{{Term}}</div>
                    {{TermAudio}}
                    <div class="example">{{Example}}</div>
                """,
                "afmt": """
                    {{FrontSide}}
                    <hr id="answer">
                    {{MeaningAudio}}
                    <div class="reading">{{Reading}}</div>
                    <div class="meaning">{{Meaning}}</div>
                    <div class="example-translation">{{ExampleTranslation}}</div>
                """,
            },
            {
                "name": f"{source_language} to {target_language}",
                "qfmt": """
                    <div class="meaning">{{Meaning}}</div>
                    {{MeaningAudio}}
                    <div class="example-translation">{{ExampleTranslation}}</div>
                """,
                "afmt": """
                    {{FrontSide}}
                    <hr id="answer">
                    <div class="term">{{Term}}</div>
                    {{TermAudio}}
                    <div class="reading">{{Reading}}</div>
                    <div class="example">{{Example}}</div>
                """,
            },
        ],
        css=ANKI_CARD_CSS,
    )

    default_deck = genanki.Deck(
        deck_id=_id_from_name(f"{deck_name}::Default"), name=f"{deck_name}::Default"
    )

    media_files = []

    # Create temporary directory for media files
    temp_dir = tempfile.TemporaryDirectory()

    for i, item in enumerate(vocab_items):
        # Prepare fields for Default model
        fields_default = [
            item.front,
            item.front_sub,
            item.back,
            item.front_context or "",
            item.back_context or "",
            "",  # Term audio placeholder
            "",  # Meaning audio placeholder
        ]

        # Create a unique filename based on content hash
        def _add_audio(term: str) -> str:
            if term not in audio_mapping:
                return ""
            audio_filename = f"audio_{hashlib.md5(term.encode()).hexdigest()[:8]}.mp3"
            audio_path = Path(temp_dir.name) / audio_filename
            audio_path.write_bytes(audio_mapping[term].data)
            media_files.append(str(audio_path))
            return f"[sound:{audio_filename}]"

        fields_default[5] = _add_audio(item.front_sub if item.front_sub else item.front)
        fields_default[6] = _add_audio(item.back)

        # Create and add Default note
        note_default = genanki.Note(model=default_model, fields=fields_default)
        default_deck.add_note(note_default)

    package = genanki.Package([default_deck])
    package.media_files = media_files
    package.write_to_file(output_path)

    return package
