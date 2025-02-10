#!/usr/bin/env python3
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Annotated, List, Optional

import typer
from google import genai
from multivox.cache import default_file_cache
from multivox.types import Chapter, Scenario
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

# Initialize Gemini client
client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"), http_options={"api_version": "v1alpha"}
)
CHAPTER_LIST_MODEL_ID = "gemini-2.0-flash-thinking-exp"
CHAPTER_GEN_MODEL_ID = "gemini-2.0-flash"

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
      "key_terms": ["term1", "term2", "etc"]
    }
  ]
}
"""

CHAPTER_EXPANSION_PROMPT = """
Create 5 related conversations for this chapter:

{chapter_description}

Requirements:
- Each conversation should build on previous ones
- Include specific vocabulary and phrases to practice
- Provide clear context and goals for each conversation
- Ensure natural progression of difficulty

The "instructions" field should contain detailed guidance for the conversation practice. For example:

```
* You are pretending to be a hotel receptionist.
* Act as a hotel receptionist at a front desk would.
* Don't generate responses like "Sorry we don't have any rooms." that would end the conversation abruptly.
* Don't explain yourself or refer to yourself e.g. as "I'm a helpful receptionist".

A guest approaches...
```

Output only valid JSON in this exact format:
{{
  "conversations": [
    {{
      "id": "<descriptive url-friendly slug for this conversation>",
      "title": "Conversation Title",
      "description": "Detailed description of the conversation scenario",
      "key_terms": ["term1", "term2"],
      "instructions": "Detailed instructions for the conversation practice"
    }}
  ]
}}
"""


@file_cache()
def generate_chapter_list(
    model=CHAPTER_LIST_MODEL_ID, prompt=CHAPTERS_LIST_PROMPT
) -> List[dict]:
    """Generate list of chapter descriptions using LLM"""
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        # config={"response_mime_type": "application/json"}
    )

    response_text = response.text
    if response_text.startswith("```json"):
        response_text = response_text[7:-3]

    data = json.loads(response_text)
    return data["chapters"]


@file_cache()
def generate_chapter_conversations(
    chapter: dict,
    chapter_num: int,
    prompt: str = CHAPTER_EXPANSION_PROMPT,
    model: str = CHAPTER_GEN_MODEL_ID,
) -> List[dict]:
    """Generate conversations for a chapter using LLM"""
    console.print(f"Generating conversations for chapter {chapter['title']}...")
    formatted_prompt = prompt.format(
        chapter_description=json.dumps(chapter, indent=2),
        chapter_num=chapter_num
    )

    response = client.models.generate_content(
        model=model,
        contents=formatted_prompt,
        config={"response_mime_type": "application/json"},
    )

    data = json.loads(response.text)
    return data["conversations"]


def generate_chapter_with_conversations(chapter_data: tuple[dict, int]) -> Optional[Chapter]:
    """Generate a single chapter with its conversations"""
    chapter, chapter_num = chapter_data
    try:
        conversations = generate_chapter_conversations(chapter, chapter_num)
        return Chapter(
            id=chapter["id"],
            title=chapter["title"],
            description=chapter["description"],
            key_terms=chapter["key_terms"],
            conversations=[Scenario(**conv) for conv in conversations],
        )
    except Exception:
        logging.exception(f"Failed to generate conversations for chapter {chapter['title']}")
        return None

def generate_chapters() -> List[Chapter]:
    """Generate full chapter list with conversations in parallel"""
    chapters_list = generate_chapter_list()

    with ThreadPoolExecutor(max_workers=20) as executor:
        chapters = executor.map(
            generate_chapter_with_conversations,
            [(chapter, i) for i, chapter in enumerate(chapters_list, 1)]
        )

    return [chapter for chapter in chapters if chapter is not None]

@app.command()
def list_chapters():
    """Generate and show list of chapters"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task("Generating chapter list...", total=None)
        chapters = generate_chapter_list()

    console.print("\nGenerated Chapters:")
    for i, chapter in enumerate(chapters, 1):
        console.print(f"[bold]Chapter {i}: {chapter['title']}[/bold]")
        console.print(f"  {chapter['description']}\n")


@app.command(name="generate-chapter")
def cmd_generate_chapter(
    chapter_num: Annotated[int, typer.Option()],
    chapter_file: Annotated[str, typer.Option()] = "chapter.json"
):
    """Generate a single chapter's conversations"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task("Loading chapters...", total=None)
        chapters = generate_chapter_list()

        if chapter_num < 1 or chapter_num > len(chapters):
            console.print(f"[red]Chapter number must be between 1 and {len(chapters)}")
            return

        chapter = chapters[chapter_num - 1]
        progress.add_task("Generating conversations...", total=None)
        conversations = generate_chapter_conversations(chapter, chapter_num)

        complete_chapter = Chapter(
            id=chapter["id"],
            title=chapter["title"],
            description=chapter["description"],
            key_terms=chapter["key_terms"],
            conversations=[Scenario(**conv) for conv in conversations],
        )

    with open(chapter_file, "w") as f:
        json.dump(complete_chapter.model_dump(), f, indent=2)
        console.print(f"\nSaved chapter to {chapter_file}")


@app.command(name="generate-all")
def cmd_generate_all(output_file: str = typer.Option("multivox/chapters.json")):
    """Generate all chapters with conversations"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task("Generating chapters...", total=None)
        chapters = generate_chapters()

    with open(output_file, "w") as f:
        json.dump([c.model_dump() for c in chapters], f, indent=2)
        console.print(f"\nSaved chapters to {output_file}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(filename)s:%(funcName)s:%(lineno)d:%(asctime)s:%(message)s",
    )
    app()
