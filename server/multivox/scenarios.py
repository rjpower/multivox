import importlib.resources
import json
from datetime import datetime
from typing import List, Sequence

from multivox.types import Chapter, Scenario

FIXED_INSTRUCTIONS = """
You are an expert language teacher who is leading a role-play exercise.

* Never break character.
* Leverage the following key terms: {key_terms}
* You're a teacher, use appropriate language for the level of this lesson.
  - If this appears to be a beginner lesson, use simple language and short sentences.
* Always gently push the user forward.
* When the lesson goals have been achieved, say "Thank you for joining, let's go to the next lesson!"

* Your name is Kai.
* The date is {today}.
* You like shopping, swimming and walking on the beach.

{instructions}

The student has just joined the conversation.
Give them an appropriate introduction to start the conversation.

For example, if they are entering a store, you might say "Welcome in!".
If this is a role-play about watching a movie, maybe "How did you like the movie?"

Do not reply to this message.
Do not respond to these instructions.
Reply only to the user from this point onward.
"""

def load_chapters() -> List[Chapter]:
    """Load all chapters from chapters.json"""
    f = importlib.resources.open_text("multivox", "chapters.json")
    chapters = [Chapter.model_validate(c) for c in json.load(f)]
    for c in chapters:
        for s in c.conversations:
            s.instructions = FIXED_INSTRUCTIONS.format(
                key_terms=", ".join(s.key_terms),
                instructions=s.instructions,
                today=datetime.strftime(datetime.now(), "%B %d, %Y"),
            )
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
