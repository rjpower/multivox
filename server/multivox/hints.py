import logging

from litellm import acompletion

from multivox.config import settings
from multivox.types import HintResponse, Language

logger = logging.getLogger(__name__)

HINT_PROMPT = """
You are a language expert. Generate 3 natural responses to this conversation.
Output only valid JSON in this exact format:
Provide responses that would be appropriate in the conversation.

{
    "hints": [
        {
            "native": "<Response to the conversation, consistent with the level of the user>",
            "translation": "<translation in idiomatic English>"
        }
    ]
}

Do not include any other text or explanations.
Only provide responses suitable for the "user" role.
Do not provide responses for the "assistant".
"""

async def generate_hints(
    history: str,
    language: Language | None,
    hint_model: str = settings.HINT_MODEL_ID,
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
        model=hint_model, messages=messages, response_format={"type": "json_object"}
    )

    try:
        return HintResponse.model_validate_json(response.choices[0].message.content)  # type: ignore
    except Exception:
        logger.error("Failed to parse hints response: %s", response)
        raise
