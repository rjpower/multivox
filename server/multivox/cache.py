import functools
import hashlib
import inspect
import logging
import pickle
from pathlib import Path
from typing import Callable, Optional, TypeVar

T = TypeVar('T')
logger = logging.getLogger(__name__)


def _default_key_fn(func: Callable, args: tuple, kwargs: dict) -> str:
    """Generate cache key including function signature and all arguments."""
    # Get function's signature
    sig = inspect.signature(func)

    # Bind arguments to signature, this handles defaults
    bound_args = sig.bind(*args, **kwargs)
    bound_args.apply_defaults()

    # Build key parts
    key_parts = []

    # Add qualified function name
    key_parts.append(f"{func.__module__}.{func.__qualname__}")

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

    def __init__(self, cache_dir: str):
        """Initialize cache with specified directory."""
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, key: str) -> Path:
        """Generate cache file path from key using MD5 hash."""
        hash_key = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{hash_key}.pkl"

    def __call__(self, key_fn: Optional[Callable] = None):
        """Decorator that caches function results using the provided key function."""
        if key_fn is None:
            key_fn = _default_key_fn

        def decorator(func: Callable[..., T]) -> Callable[..., T]:
            @functools.wraps(func)
            def wrapper(*args, **kwargs) -> T:
                cache_key = key_fn(func, args, kwargs)
                cache_path = self._get_cache_path(cache_key)
                hash_key = hashlib.md5(cache_key.encode()).hexdigest()
                logger.info("Calling %s with cache key %s", func.__name__, hash_key)

                if cache_path.exists():
                    return pickle.loads(cache_path.read_bytes())

                logger.info("Cache miss for %s", hash_key)
                result = func(*args, **kwargs)
                cache_path.write_bytes(pickle.dumps(result))
                return result
            return wrapper

        return decorator

    def cache_async(self, key_fn: Optional[Callable] = None):
        """Decorator that caches async function results using the provided key function."""
        if key_fn is None:
            key_fn = _default_key_fn

        def decorator(func: Callable[..., T]) -> Callable[..., T]:
            @functools.wraps(func)
            async def wrapper(*args, **kwargs) -> T:
                cache_key = key_fn(func, args, kwargs)
                cache_path = self._get_cache_path(cache_key)
                hash_key = hashlib.md5(cache_key.encode()).hexdigest()
                logger.info("Calling %s with cache key %s", func.__name__, hash_key)

                if cache_path.exists():
                    return pickle.loads(cache_path.read_bytes())

                logger.info("Cache miss for %s", hash_key)
                result = await func(*args, **kwargs)
                cache_path.write_bytes(pickle.dumps(result))
                return result
            return wrapper

        return decorator


ROOT_DIR = Path(__file__).resolve().parent.parent.parent
default_file_cache = FileCache(cache_dir=ROOT_DIR / "cache")
