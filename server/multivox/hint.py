import logging

from litellm import acompletion

from multivox.config import settings
from multivox.prompts import HINT_PROMPT
from multivox.types import HintResponse, Language

logger = logging.getLogger(__name__)


async def generate_hints(
    history: str,
    scenario: str,
    source_language: Language,
    target_language: Language,
    model_id: str = settings.HINT_MODEL_ID,
    hint_prompt: str = HINT_PROMPT,
) -> HintResponse:
    """Generate possible responses to audio input"""
    language_prompt = hint_prompt.format(
        scenario=scenario,
        source_language=source_language,
        target_language=target_language,
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
