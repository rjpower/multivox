import functools
import hashlib
import inspect
import json
import logging
import pickle
from pathlib import Path
from typing import Any, Awaitable, Callable, List, Optional, cast

import litellm
from pydantic import BaseModel

from multivox.config import settings

logger = logging.getLogger(__name__)


def _default_key_fn(func: Callable, *args: tuple, **kwargs: dict) -> str:
    """Generate cache key including function signature and all arguments."""
    # Get function's signature
    sig = inspect.signature(func)

    # Bind arguments to signature, this handles defaults
    bound_args = sig.bind(*args, *kwargs)
    bound_args.apply_defaults()

    # Build key parts
    key_parts = []

    # Add qualified function name and bytecode hash
    bytecode = getattr(func, '__code__', None)
    bytecode_hash = ''
    if bytecode:
        bytecode_hash = hashlib.md5(bytecode.co_code).hexdigest()
    key_parts.append(f"{func.__module__}.{func.__qualname__}:{bytecode_hash}")

    # Add all arguments including defaults
    for param_name, value in bound_args.arguments.items():
        if param_name == "self":
            continue
        # Handle Language objects specially
        if hasattr(value, 'abbreviation') and hasattr(value, 'name'):
            key_parts.append(f"{param_name}={value.abbreviation}")
        else:
            key_parts.append(f"{param_name}={value}")

    # Add any kwargs
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}={v}")

    return ":".join(key_parts)

class FileCache:
    """File system based cache that stores call results."""

    def __init__(self, cache_dir: Path):
        """Initialize cache with specified directory."""
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, key: str) -> Path:
        """Generate cache file path from key using MD5 hash."""
        hash_key = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{hash_key}.pkl"

    def cache_fn[
        F: Callable[..., Any]
    ](self, key_fn: Optional[Callable] = None) -> Callable[[F], F]:
        """Decorator that caches function results using the provided key function."""
        if key_fn is None:
            key_fn = _default_key_fn

        def decorator(func: F) -> F:
            @functools.wraps(func)
            def wrapper(*args, **kwargs) -> Any:
                cache_key = key_fn(func, *args, **kwargs)
                cache_path = self._get_cache_path(cache_key)
                hash_key = hashlib.md5(cache_key.encode()).hexdigest()
                logger.info("Calling %s with cache key %s", func.__name__, hash_key)

                if cache_path.exists():
                    return pickle.loads(cache_path.read_bytes())

                logger.info("Cache miss for %s", hash_key)
                result = func(*args, **kwargs)
                cache_path.write_bytes(pickle.dumps(result))
                return result

            return cast(F, wrapper)

        return decorator

    def cache_fn_async[
        F: Callable[..., Awaitable[Any]]
    ](self, key_fn: Optional[Callable] = None) -> Callable[[F], F]:
        """Decorator that caches async function results using the provided key function."""
        if key_fn is None:
            key_fn = _default_key_fn

        def decorator(func: F) -> F:
            @functools.wraps(func)
            async def wrapper(*args, **kwargs) -> Any:
                cache_key = key_fn(func, *args, **kwargs)
                cache_path = self._get_cache_path(cache_key)
                hash_key = hashlib.md5(cache_key.encode()).hexdigest()
                logger.info("Calling %s with cache key %s", func.__name__, hash_key)

                if cache_path.exists():
                    return pickle.loads(cache_path.read_bytes())

                logger.info("Cache miss for %s", hash_key)
                result = await func(*args, **kwargs)
                cache_path.write_bytes(pickle.dumps(result))
                return result

            return cast(F, wrapper)

        return decorator


default_file_cache = FileCache(cache_dir=settings.ROOT_DIR / "cache")


def cached_completion(
    messages: List[dict],
    api_key: Optional[str] = None,
    response_format: type[BaseModel] | None = None,
    **kw,
) -> str:
    """Execute LLM completion with caching

    Args:
        messages: The messages to send to the LLM
        api_key: Optional Gemini API key to use for the request
        **kw: Additional keyword arguments for the completion

    Returns:
        Parsed response from LLM
    """
    filtered_kw = {
        key: value
        for key, value in kw.items()
        if isinstance(value, (int, str, float, dict, list)) and key != "api_key"
    }
    filtered_kw["model"] = settings.COMPLETION_MODEL_ID

    cache_key = json.dumps({"messages": messages, **filtered_kw}, sort_keys=True)
    cache_path = (
        settings.ROOT_DIR
        / "cache"
        / f"{hashlib.md5(cache_key.encode()).hexdigest()}.json"
    )
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8")

    # Pass api_key directly to completion call if provided
    response = litellm.completion(
        model=settings.COMPLETION_MODEL_ID,
        messages=messages,
        api_key=api_key,
        response_format=response_format,
        **kw,
    )

    result = response.choices[0].message.content  # type: ignore
    cache_path.write_text(result)
    return result  # type: ignore
