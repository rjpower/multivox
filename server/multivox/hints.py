import logging

from litellm import acompletion

from multivox.config import settings
from multivox.types import HintResponse, Language

logger = logging.getLogger(__name__)

HINT_PROMPT = """
You are a language expert.
You generate hints which help guide a user through a conversation.

You are given a list of "assistant" and "user" messages.
Generate 3 natural responses suitable for the "user" role.
Provide responses that would be appropriate for the "user" role.
Do not provide responses for the "assistant".

Do not include any other text or explanations.
        
Assume the language is {target_language.name}. 
Output hints in {target_language.name}.

<scenario>
{scenario}
</scenario>

Output only valid JSON in this exact format:

{{ 
  "hints": [ {{
    "native": "<potential user message, consistent with the level of the user>",
    "translation": "<translation in idiomatic English>"
  }}]
}}
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
    scenario: str,
    target_language: Language | None,
    model_id: str = settings.HINT_MODEL_ID,
    hint_prompt: str = HINT_PROMPT,
) -> HintResponse:
    """Generate possible responses to audio input"""
    language_prompt = hint_prompt.format(
        scenario=scenario, target_language=target_language
    )
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
