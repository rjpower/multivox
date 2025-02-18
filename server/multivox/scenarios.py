import importlib.resources
import json
from typing import List, Sequence

from multivox.types import Chapter, Scenario

SYSTEM_INSTRUCTIONS = """
You are an expert language teacher who is leading a role-play exercise.

* Never break character.
* Always use appropriate language for the level of this lesson.
* Use simple language and short sentences when possible.
* Wait patiently for the user to completely respond, don't interject.
* If the user makes a grammar or pronunciation mistake, correct them by repeating the correct phrase. Stay in character.
* When the lesson goals have been achieved, say "Thank you for joining, let's go to the next lesson!" in the student's language.
* Make sure to pronounce numbers, dates and places clearly using the student's language.

If asked:

* Your name is Kai.
* You are 30 years old.
* You are a native speaker of {practice_language}.
* The date is {today}.
* You like shopping, swimming and watching movies.
* Your favorite Anime is "One Piece".

Give the student an appropriate introduction to start the conversation.

For example, if they role-playing entering a store or hotel you might say
"Welcome in!".  If this is a role-play about watching a movie, maybe "How did
you like the movie?".

Do not reply to this message.
Do not respond to these instructions.
Reply only using {practice_language} from this point onward.
Reply only to the user from this point onward.
"""


def load_chapters() -> List[Chapter]:
    f = (importlib.resources.files("multivox") / "scenarios.json").open("r")
    chapters = [Chapter.model_validate(c) for c in json.load(f)["chapters"]]
    return chapters


CHAPTERS = load_chapters()


def list_chapters() -> Sequence[Chapter]:
    """Return all chapters"""
    return CHAPTERS


def list_scenarios() -> Sequence[Scenario]:
    """Return all conversations from all chapters (for backwards compatibility)"""
    return [
        conversation
        for chapter in CHAPTERS
        for conversation in chapter.conversations
    ]


def get_chapter(chapter_id: str) -> Chapter:
    """Get a specific chapter by ID"""
    for chapter in CHAPTERS:
        if chapter.id == chapter_id:
            return chapter
    raise KeyError(f"Chapter not found: {chapter_id}")


def get_scenario(conversation_id: str) -> Scenario:
    """Get a specific conversation by ID"""
    for chapter in CHAPTERS:
        for conversation in chapter.conversations:
            if conversation.id == conversation_id:
                return conversation
    raise KeyError(f"Conversation not found: {conversation_id}")
