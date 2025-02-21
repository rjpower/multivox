import logging

from litellm import acompletion

from multivox.cache import default_file_cache
from multivox.types import (
    LANGUAGES,
    TranslateRequest,
    TranslateResponse,
)

logger = logging.getLogger(__name__)


@default_file_cache.cache_fn_async()
async def translate(
    request: TranslateRequest,
) -> TranslateResponse:
    source_language = LANGUAGES[request.source_language]
    target_language = LANGUAGES[request.target_language]
    logger.info("Translating text from %s to %s", request.source_language, request.target_language)
    system_prompt = request.system_prompt.format(
        source_language=source_language.name,
        target_language=target_language.name,
    )
    translation_prompt = request.translation_prompt.format(
        source_language=source_language.name,
        target_language=target_language.name,
    )
    text = f"<input>{request.text}</input>"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": translation_prompt + "\n" + text}
    ]

    response = await acompletion(
        model=request.model_id,
        messages=messages,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content  # type: ignore

    try:
        return TranslateResponse.model_validate_json(content)
    except Exception:
        logger.exception(f"Failed to parse translation response from {content}")
        raise
