import logging

from litellm import acompletion

from multivox.types import LANGUAGES, HintRequest, HintResponse

logger = logging.getLogger(__name__)


async def generate_hints(request: HintRequest) -> HintResponse:
    """Generate possible responses to audio input"""
    source_language = LANGUAGES[request.source_language]
    target_language = LANGUAGES[request.target_language]
    
    language_prompt = request.hint_prompt.format(
        scenario=request.scenario,
        source_language=source_language,
        target_language=target_language,
    )
    logger.info("Generating hints for: %s", request.history)

    messages = [
        {"role": "system", "content": language_prompt},
        {"role": "user", "content": request.hint_prompt + "\n" + request.history}
    ]

    response = await acompletion(
        model=request.model_id,
        messages=messages,
        response_format={"type": "json_object"},
        api_key=request.api_key,
    )

    try:
        return HintResponse.model_validate_json(response.choices[0].message.content)  # type: ignore
    except Exception:
        logger.error("Failed to parse hints response: %s", response)
        raise
