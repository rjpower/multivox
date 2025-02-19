import logging

from litellm import acompletion

from multivox.cache import default_file_cache
from multivox.config import settings
from multivox.prompts import TRANSLATION_PROMPT, TRANSLATION_SYSTEM_PROMPT
from multivox.types import Language, TranslateResponse

logger = logging.getLogger(__name__)


@default_file_cache.cache_fn_async()
async def translate(
    text: str,
    source_language: Language,
    target_language: Language,
    system_prompt: str = TRANSLATION_SYSTEM_PROMPT,
    translation_prompt: str = TRANSLATION_PROMPT,
    model_id: str = settings.TRANSLATION_MODEL_ID,
    api_key: str | None = None,
) -> TranslateResponse:
    logger.info("Translating text from %s to %s", source_language, target_language)
    system_prompt = system_prompt.format(
        source_language=source_language.name,
        target_language=target_language.name,
    )
    translation_prompt = translation_prompt.format(
        source_language=source_language.name,
        target_language=target_language.name,
    )
    text = f"<input>{text}</input>"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": translation_prompt + "\n" + text}
    ]

    response = await acompletion(
        model=model_id,
        messages=messages,
        response_format={"type": "json_object"},
        api_key=api_key,
    )

    content = response.choices[0].message.content  # type: ignore

    try:
        return TranslateResponse.model_validate_json(content)
    except Exception:
        logger.exception(f"Failed to parse translation response from {content}")
        raise
