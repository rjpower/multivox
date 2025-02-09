#!/usr/bin/env python3
import asyncio
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Annotated, List, Optional

import typer
from google import genai
from multivox.cache import default_file_cache
from multivox.types import Scenario, ScenarioDescription
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

# Initialize Gemini client
client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"), http_options={"api_version": "v1alpha"}
)
MODEL_ID = "gemini-2.0-flash"

file_cache = default_file_cache
console = Console()
app = typer.Typer()

SCENARIOS_LIST_PROMPT = """
Generate a list of _100_ language learning scenarios, with 10 for each level from:

BEGINNER = 1
ELEMENTARY = 2
PRE_INTERMEDIATE = 3
INTERMEDIATE = 4
UPPER_INTERMEDIATE = 5
PRE_ADVANCED = 6
ADVANCED = 7
UPPER_ADVANCED = 8
EXPERT = 9
MASTERY = 10

Each scenario should be a common real-world situation where language skills are needed.

Requirements:
- id should be URL-friendly lowercase with hyphens
- title should be clear and concise
- difficulty must be 1-10 integer
- summary should be 1-2 sentences
- scenarios should progress logically in difficulty
- focus on practical, real-world situations
- start with simple greetings with minimal vocabulary and progress to complex conversations

Output only valid JSON in this exact format:
{
  "scenarios": [
    { "title": "Scenario Title",
       "summary": "Brief description of the scenario"
       "id": "scenario-slug",
       "difficulty": 1-10 }
  ]
}
"""

SCENARIO_PROMPT = """
Create a detailed language learning scenario based on this description:

{summary}

Reference this example for how to generate good instructions:

{example_instructions}

Requirements:
- Keep the id, title and difficulty exactly as provided
- Instructions should be 2-4 paragraphs
- Include clear role-play setup
- Define the teacher/assistant's character and behavior
- Explain the scenario context
- Aim for a difficulty level of {difficulty} on a scale of 1-10

Output only valid JSON in this exact format.
Output only a single object.
Output nothing other than JSON.
{{
  "title": "{title}",
  "instructions": "<Detailed multi-paragraph instructions based on the example(s) above>",
  "id": "<slug based on the title>"
}}
"""


@file_cache()
def generate_scenario_list(
    model=MODEL_ID, prompt=SCENARIOS_LIST_PROMPT
) -> List[ScenarioDescription]:
    """Generate list of scenario descriptions using LLM"""
    response = client.models.generate_content(
        model=model, contents=prompt, config={"response_mime_type": "application/json"}
    )

    data = json.loads(response.text)
    return [ScenarioDescription(**s) for s in data["scenarios"]]


@file_cache()
def generate_single_scenario(
    title: str,
    description: str,
    example_instructions: str,
    difficulty: int,
    scenario_prompt: str = SCENARIO_PROMPT,
) -> Scenario:
    """Generate detailed scenario from description using LLM"""
    prompt = scenario_prompt.format(
        summary=description,
        example_instructions=example_instructions,
        title=title,
        difficulty=difficulty,
    )

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config={"response_mime_type": "application/json"}
    )
    response_obj = json.loads(response.text)
    return Scenario(
        id=response_obj["id"],
        title=title,
        instructions=response_obj["instructions"],
        difficulty=difficulty,
    )

    return Scenario.model_validate_json(response.text)


def generate_scenarios(
    descriptions: List[ScenarioDescription], example_instructions: str
) -> List[Scenario]:
    """Generate multiple scenarios concurrently using thread pool"""

    def generate_one(desc: ScenarioDescription) -> Optional[Scenario]:
        try:
            return generate_single_scenario(
                title=desc.title,
                description=desc.summary,
                example_instructions=example_instructions,
                difficulty=desc.difficulty,
            )
        except Exception:
            logging.exception(f"Failed to generate scenario {desc.title}")
            return None

    with ThreadPoolExecutor(max_workers=16) as executor:
        return [
            s for s in executor.map(lambda desc: generate_one(desc), descriptions) if s
        ]


def example_instructions() -> str:
    """Get example instructions from existing scenarios"""
    return """
We are going to role-play a scenario.
You are an expert teacher who is helping a student practice their speaking.

* You are acting as a hotel receptionist.
* You act _exactly_ as a hotel receptionist at a front desk would.
* Do not break character under any circumstances.
* You don't speak any other languages other than this one.
* Don't generate responses like "Sorry we don't have any rooms." that would end the conversation abruptly.
* You don't explain yourself or refer to yourself e.g. as "I'm a helpful receptionist".
* You are gentle and use simple language when necessary.
* If the student makes a mistake, repeat the correct phrase back to them.
* If the student is stuck, give them a hint, ask a question, or move the conversation forward yourself.

A guest approaches...
"""


@app.command()
def list_scenarios():
    """Generate and show list of scenario descriptions"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task("Generating scenario list...", total=None)
        scenarios = generate_scenario_list()

    console.print("\nGenerated Scenarios:")
    for s in scenarios:
        console.print(f"[bold]{s.title}[/bold] (Level {s.difficulty})")
        console.print(f"  {s.summary}\n")


@app.command(name="generate-scenario")
def cmd_generate_single_scenario(
    title: Annotated[str, typer.Option()],
    description: Annotated[str, typer.Option()],
    difficulty: Annotated[int, typer.Option()],
):
    """Generate a single scenario by ID"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task("Generating scenario...", total=None)
        example = example_instructions()
        scenario = generate_single_scenario(
            title, description, example, difficulty=difficulty
        )

    console.print("\nGenerated Scenario:")
    console.print(json.dumps(scenario.model_dump(), indent=2))


@app.command(name="generate-all")
def cmd_generate_all(output_file: str = typer.Option("multivox/scenarios.json")):
    """Generate all scenarios"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        descriptions = generate_scenario_list()

        progress.add_task("Generating scenarios...", total=None)
        example = example_instructions()
        scenarios = generate_scenarios(descriptions, example)

    with open(output_file, "w") as f:
        json.dump([s.model_dump() for s in scenarios], f, indent=2)
        console.print(f"\nSaved scenarios to {output_file}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(filename)s:%(funcName)s:%(lineno)d:%(asctime)s:%(message)s",
    )
    app()
