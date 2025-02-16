import logging

from litellm import acompletion

from multivox.config import settings
from multivox.types import HintResponse, Language

logger = logging.getLogger(__name__)

HINT_FORMAT = """
{
 "hints": [ {
    "native": "<Response to the conversation, consistent with the level of the user>",
    "translation": "<translation in idiomatic English>"
  }]
}
"""


HINT_PROMPT = f"""
You are a language expert. 

Generate 3 natural responses to this conversation.
Provide responses that would be appropriate in the conversation.
Do not include any other text or explanations.
Only provide responses suitable for the "user" role.
Do not provide responses for the "assistant".

Output only valid JSON in this exact format:

{HINT_FORMAT}
"""

STREAMING_HINT_PROMPT = """
<INSTRUCTIONS>
Good job.

Now I need you to generate 3 natural responses for the _user_ to this conversation.
Only provide responses suitable for the "user" role.
Do not provide responses for the "assistant".

You must call the `hint` tool with the following arguments:

```
hint({
  hints=[{
    "native": "<Response to the conversation, consistent with the level of the user>",
    "translation": "<translation in idiomatic English>"
  }]
})
```

Only call `hint`.
Perform no other operations.
You _must_ call `hint` before ending your turn.
</INSTRUCTIONS>
"""


async def generate_hints(
    history: str,
    language: Language | None,
    model_id: str = settings.HINT_MODEL_ID,
    hint_prompt: str = HINT_PROMPT,
) -> HintResponse:
    """Generate possible responses to audio input"""
    language_prompt = f"Assume the language is {language.name}.\n" if language else "\n"
    logger.info("Generating hints for: %s", history)

    messages = [
        {"role": "system", "content": language_prompt},
        {"role": "user", "content": hint_prompt + "\n" + history}
    ]

    response = await acompletion(
        model=model_id,
        messages=messages,
        response_format={"type": "json_object"},
        api_key=(
            settings.GEMINI_API_KEY if "gemini" in model_id else settings.OPENAI_API_KEY
        ),
    )

    try:
        return HintResponse.model_validate_json(response.choices[0].message.content)  # type: ignore
    except Exception:
        logger.error("Failed to parse hints response: %s", response)
        raise
