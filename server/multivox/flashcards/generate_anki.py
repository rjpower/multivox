import hashlib
import tempfile
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional, Sequence

import genanki
from google.cloud import texttospeech
from google.oauth2 import service_account
from multivox import cache
from multivox.config import settings
from multivox.flashcards.schema import FlashCard, FlashcardLanguage, VocabItem

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


AUDIO_MODELS = {
    FlashcardLanguage.ENGLISH: AudioModel("en-US", "en-US-Neural2-C"),
    FlashcardLanguage.JAPANESE: AudioModel("ja-JP", "ja-JP-Neural2-B"),
    FlashcardLanguage.SPANISH: AudioModel("es-ES", "es-ES-Neural"),
    FlashcardLanguage.CHINESE: AudioModel("cmn-CN", "cmn-CN-Standard-A"),
    FlashcardLanguage.ARABIC: AudioModel("ar-XA", "ar-XA-Neural2-A"),
    FlashcardLanguage.BASQUE: AudioModel("eu-ES", "eu-ES-Standard-A"),
    FlashcardLanguage.BENGALI: AudioModel("bn-IN", "bn-IN-Neural2-A"),
    FlashcardLanguage.BULGARIAN: AudioModel("bg-BG", "bg-BG-Standard-A"),
    FlashcardLanguage.CATALAN: AudioModel("ca-ES", "ca-ES-Standard-A"),
    FlashcardLanguage.CZECH: AudioModel("cs-CZ", "cs-CZ-Wavenet-A"),
    FlashcardLanguage.DANISH: AudioModel("da-DK", "da-DK-Neural2-D"),
    FlashcardLanguage.DUTCH_BE: AudioModel("nl-BE", "nl-BE-Standard-A"),
    FlashcardLanguage.DUTCH_NL: AudioModel("nl-NL", "nl-NL-Neural2-A"),
    FlashcardLanguage.FILIPINO: AudioModel("fil-PH", "fil-PH-Neural2-A"),
    FlashcardLanguage.FINNISH: AudioModel("fi-FI", "fi-FI-Wavenet-A"),
    FlashcardLanguage.FRENCH_CA: AudioModel("fr-CA", "fr-CA-Neural2-A"),
    FlashcardLanguage.FRENCH_FR: AudioModel("fr-FR", "fr-FR-Neural2-A"),
    FlashcardLanguage.GALICIAN: AudioModel("gl-ES", "gl-ES-Standard-A"),
    FlashcardLanguage.GERMAN: AudioModel("de-DE", "de-DE-Neural2-A"),
    FlashcardLanguage.GREEK: AudioModel("el-GR", "el-GR-Neural2-A"),
    FlashcardLanguage.GUJARATI: AudioModel("gu-IN", "gu-IN-Wavenet-A"),
    FlashcardLanguage.HEBREW: AudioModel("he-IL", "he-IL-Neural2-A"),
    FlashcardLanguage.HINDI: AudioModel("hi-IN", "hi-IN-Neural2-A"),
    FlashcardLanguage.HUNGARIAN: AudioModel("hu-HU", "hu-HU-Wavenet-A"),
    FlashcardLanguage.INDONESIAN: AudioModel("id-ID", "id-ID-Wavenet-A"),
    FlashcardLanguage.ITALIAN: AudioModel("it-IT", "it-IT-Neural2-A"),
    FlashcardLanguage.KANNADA: AudioModel("kn-IN", "kn-IN-Wavenet-A"),
    FlashcardLanguage.KOREAN: AudioModel("ko-KR", "ko-KR-Neural2-A"),
    FlashcardLanguage.LATVIAN: AudioModel("lv-LV", "lv-LV-Standard-A"),
    FlashcardLanguage.LITHUANIAN: AudioModel("lt-LT", "lt-LT-Standard-A"),
    FlashcardLanguage.MALAY: AudioModel("ms-MY", "ms-MY-Wavenet-A"),
    FlashcardLanguage.MALAYALAM: AudioModel("ml-IN", "ml-IN-Wavenet-A"),
    FlashcardLanguage.MANDARIN_CN: AudioModel("cmn-CN", "cmn-CN-Neural2-A"),
    FlashcardLanguage.MANDARIN_TW: AudioModel("cmn-TW", "cmn-TW-Wavenet-A"),
    FlashcardLanguage.MARATHI: AudioModel("mr-IN", "mr-IN-Wavenet-A"),
    FlashcardLanguage.NORWEGIAN: AudioModel("nb-NO", "nb-NO-Wavenet-A"),
    FlashcardLanguage.POLISH: AudioModel("pl-PL", "pl-PL-Wavenet-A"),
    FlashcardLanguage.PORTUGUESE_BR: AudioModel("pt-BR", "pt-BR-Neural2-A"),
    FlashcardLanguage.PORTUGUESE_PT: AudioModel("pt-PT", "pt-PT-Wavenet-A"),
    FlashcardLanguage.PUNJABI: AudioModel("pa-IN", "pa-IN-Wavenet-A"),
    FlashcardLanguage.ROMANIAN: AudioModel("ro-RO", "ro-RO-Wavenet-A"),
    FlashcardLanguage.RUSSIAN: AudioModel("ru-RU", "ru-RU-Neural2-A"),
    FlashcardLanguage.SERBIAN: AudioModel("sr-RS", "sr-RS-Standard-A"),
    FlashcardLanguage.SLOVAK: AudioModel("sk-SK", "sk-SK-Wavenet-A"),
    FlashcardLanguage.SPANISH_ES: AudioModel("es-ES", "es-ES-Neural2-A"),
    FlashcardLanguage.SPANISH_US: AudioModel("es-US", "es-US-Neural2-A"),
    FlashcardLanguage.SWEDISH: AudioModel("sv-SE", "sv-SE-Wavenet-A"),
    FlashcardLanguage.TAMIL: AudioModel("ta-IN", "ta-IN-Wavenet-A"),
    FlashcardLanguage.TELUGU: AudioModel("te-IN", "te-IN-Standard-A"),
    FlashcardLanguage.THAI: AudioModel("th-TH", "th-TH-Neural2-C"),
    FlashcardLanguage.TURKISH: AudioModel("tr-TR", "tr-TR-Neural2-A"),
    FlashcardLanguage.UKRAINIAN: AudioModel("uk-UA", "uk-UA-Wavenet-A"),
    FlashcardLanguage.VIETNAMESE: AudioModel("vi-VN", "vi-VN-Neural2-A"),
}


@cache.default_file_cache.cache_fn()
def generate_audio(term: str, language: FlashcardLanguage) -> Optional[bytes]:
    """Generate TTS audio for a term using Google Cloud Text-to-Speech API"""
    credentials = service_account.Credentials.from_service_account_info(
        settings.GOOGLE_SERVICE_ACCOUNT_INFO
    )
    tts_client = texttospeech.TextToSpeechClient(credentials=credentials)

    voice = texttospeech.VoiceSelectionParams(
        language_code=AUDIO_MODELS[language].language_code,
        name=AUDIO_MODELS[language].model_name,
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=0.8,
        pitch=0.0,
    )

    synthesis_input = texttospeech.SynthesisInput(text=term)

    try:
        response = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
        return response.audio_content
    except Exception as e:
        print(f"Google TTS API error for term '{term}': {str(e)}")
        return None


# we might include audio for back & context later
@dataclass
class AudioData:
    term: str
    data: bytes


def generate_audio_for_cards(
    items: Sequence[FlashCard],
    language: FlashcardLanguage,
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
            items_to_process.append((FlashcardLanguage.ENGLISH, item.back))

    total = len(items_to_process)
    completed = 0

    def _generate_audio_task(
        lang: FlashcardLanguage, term: str
    ) -> tuple[str, Optional[bytes]]:
        return term, generate_audio(term=term, language=lang)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_term = {
            executor.submit(_generate_audio_task, lang, term): term
            for (lang, term) in items_to_process
        }

        # Process completed tasks as they finish
        for future in as_completed(future_to_term):
            term = future_to_term[future]
            completed += 1

            logger(
                f"Generated audio {term} -- {completed}/{total} ({completed/total*100:.1f}%)"
            )

            try:
                term, audio_data = future.result()
                if audio_data:
                    audio_mapping[term] = AudioData(term, audio_data)
            except Exception as e:
                stack = traceback.format_exc()
                logger(f"Error generating audio for {term}: {str(e)} -- \n{stack}")

    logger(f"Completed audio generation for {completed} terms")
    return audio_mapping


def create_anki_package(
    output_path: Path,
    vocab_items: List[VocabItem],
    deck_name: str,
    audio_mapping: dict[str, AudioData],
    target_language: str,
    source_language: str = "English",
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
