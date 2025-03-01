#!/usr/bin/env python3
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Optional

import typer
from litellm import completion
from multivox.cache import default_file_cache
from multivox.types import Chapter
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

# Model configuration
CHAPTER_LIST_MODEL_ID = "gemini/gemini-2.0-flash"
CHAPTER_GEN_MODEL_ID = "gemini/gemini-2.0-flash"
# CHAPTER_GEN_MODEL_ID = "openai/gpt-4o"

file_cache = default_file_cache
console = Console()
app = typer.Typer()

CHAPTERS_LIST_PROMPT = """
Generate a comprehensive 50-chapter language learning curriculum.

Requirements:
- Chapters should build progressively from absolute beginner to advanced
- Each chapter title should clearly indicate the main learning focus
- Descriptions should be detailed enough to generate 5 related conversations
- Include key grammatical concepts and vocabulary themes
- Focus on practical, real-world communication skills

Output only valid JSON in this exact format:
{
  "chapters": [
    {
      "id": "<descriptive url-friendly slug for this chapter>",
      "title": "Chapter Title",
      "description": "Detailed 2-3 sentence description covering main concepts and goals",
    }
  ]
}
"""

CHAPTER_EXPANSION_PROMPT = """
Create 5 conversation prompts for this chapter:

<chapter>
{chapter_description}
</chapter>

Requirements for each conversation:
- Build on previous one conversations in a natural progression
- Include specific vocabulary and phrases to practice
- Be independent of each other, not requiring context from previous conversations

The "instructions" field should be a prompt for the teacher for how to role-play
a scenario. Remember the instructions are for how the _teacher_ should act, and
will not be shown to the student.  Good instructions always start with a
sentence describing the teacher's role.  They then provide any detail about the
situation (e.g. location, time of day).  They then provide a prompt for the
teacher to start the conversation.

For example, if the chapter is "Checking into a Hotel", "instructions" might be:

<good>
You are a hotel receptionist at the Hotel Magnificent.
Help the guest check in to the hotel.

A guest approaches...
</good>

if the chapter is "Ordering Food at a Restaurant", this could be a conversation prompt:

<good>
You are a waiter at Le Fancy Pants restaurant, a high-end French restaurant.
Greet the customer as they enter.
Help them find a table and give them a menu, then take their order.

A customer approaches...
</good>

<good>
You are a dungeon master leading the user through a dangerous and mysterious quest.
The user is trying to save the Kingdom of Multivox from a terrible curse.
Lead them through a detailed set of dangerous situations and make them solve hard problems.

The game begins...
</good>

bad instructions do not follow this structure, or are ambiguous:

<bad>
You are in a language class and want to make new friends. Share what you enjoy doing and ask what the other person likes.
</bad>

<bad>
The class is over and you are leaving. Say goodbye to a classmate politely, and express a desire to see them again.
</bad>

These do not specify the role as the first sentence, and the role is ambiguous. DON'T DO THIS.

Remember that good conversations are useful for language learners: don't give a scenario where
the _learner_ has to give directions, or explain something complicated.

Output only valid JSON in this exact format:
{{
  "id": "<url-friendly slug for this chapter>",
  "title": "<chapter title>",
  "conversations": [
    {{
      "id": "<url-friendly slug for this conversation>",
      "title": "<conversation title>",
      "instructions": "<detailed instructions for the conversation practice>"
    }}
  ]
}}
"""


@file_cache.cache_fn()
def generate_chapter_list(
    model=CHAPTER_LIST_MODEL_ID, prompt=CHAPTERS_LIST_PROMPT
) -> List[Chapter]:
    """Generate list of chapter descriptions using LLM"""
    response = completion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    response_text = response.choices[0].message.content  # type: ignore
    return [Chapter.model_validate(c) for c in json.loads(response_text)["chapters"]]


@file_cache.cache_fn()
def generate_chapter_conversations(
    chapter: Chapter,
    prompt: str = CHAPTER_EXPANSION_PROMPT,
    model: str = CHAPTER_GEN_MODEL_ID,
) -> Chapter:
    """Generate conversations for a chapter using LLM"""
    console.print(f"Generating conversations for chapter {chapter.title}...")
    formatted_prompt = prompt.format(
        chapter_description=chapter.model_dump_json(indent=1)
    )

    response = completion(
        model=model,
        messages=[{"role": "user", "content": formatted_prompt}],
        response_format={"type": "json_object"},
    )

    response_text = response.choices[0].message.content  # type: ignore
    try:
        return Chapter.model_validate_json(response_text)
    except Exception:
        logging.exception(f"Failed to parse {response_text}")
        raise


def generate_chapter_with_conversations(chapter: Chapter) -> Optional[Chapter]:
    """Generate a single chapter with its conversations"""
    try:
        return generate_chapter_conversations(chapter)
    except Exception:
        logging.exception(f"Failed to generate conversations for chapter {chapter}")
        return None


def generate_chapters(chapter_list: List[Chapter]) -> List[Chapter]:
    """Generate full chapter list with conversations in parallel"""
    with ThreadPoolExecutor(max_workers=20) as executor:
        chapters = executor.map(
            generate_chapter_with_conversations,
            chapter_list,
        )

    return [chapter for chapter in chapters if chapter is not None]


@app.command()
def cmd_list_chapters(
    chapters_file: str = typer.Option("multivox/chapters.json")
):
    """Generate and show list of chapters"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task("Generating chapter list...", total=None)
        chapters = generate_chapter_list()

    # Save chapters to file
    with open(chapters_file, "w") as f:
        json.dump({"chapters": chapters}, f, indent=2)
        console.print(f"\nSaved chapter list to {chapters_file}")

    # Display chapters
    console.print("\nGenerated Chapters:")
    for i, chapter in enumerate(chapters, 1):
        console.print(f"[bold]Chapter {i}: {chapter.title}")


@app.command(name="generate-chapter")
def cmd_generate_chapter(
    title: str,
    description: str,
):
    """Generate a single chapter's conversations"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task("Loading chapters...", total=None)
        chapter = Chapter(title=title, description=description)
        progress.add_task("Generating conversations...", total=None)
        complete_chapter = generate_chapter_conversations(chapter)
        print(complete_chapter)


@app.command(name="generate-all")
def cmd_generate_all(
    chapters_file: Path = typer.Option("multivox/chapters.json"),
    scenarios_file: Path = typer.Option("multivox/scenarios.json"),
):
    """Generate all chapters with conversations"""
    with Progress(
        TextColumn("[progress.description]{task.description}"), transient=True
    ) as progress:
        # First try to load existing chapters, or generate new ones
        progress.add_task("Loading/generating chapter list...", total=None)
        if chapters_file.exists():
            data = json.loads(chapters_file.read_text())
            chapter_list = [Chapter.model_validate(c) for c in data["chapters"]]
            console.print(f"\nLoaded existing chapters from {chapters_file}")
        else:
            chapter_list = generate_chapter_list()
            chapters_file.write_text(json.dumps({"chapters": chapter_list}, indent=2))

    with Progress(
        TextColumn("[progress.description]{task.description}"), transient=True
    ) as progress:
        # Generate scenarios
        progress.add_task("Generating scenarios...", total=None)
        chapters = generate_chapters(chapter_list)
        scenarios_file.write_text(
            json.dumps(
                {"chapters": [chapter.model_dump() for chapter in chapters]}, indent=2
            )
        )


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(filename)s:%(funcName)s:%(lineno)d:%(asctime)s:%(message)s",
    )
    app()
