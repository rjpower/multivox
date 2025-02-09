import functools
import hashlib
import logging
import pickle
from pathlib import Path
from typing import Callable, Optional, TypeVar

T = TypeVar('T')
logger = logging.getLogger(__name__)

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

    def _default_key_fn(*args, **kwargs) -> str:
        """Default key function that concatenates string representations of all args."""
        # Skip self argument if present
        key_parts = (
            [str(arg) for arg in args[1:]]
            if args and isinstance(args[0], FileCache)
            else [str(arg) for arg in args]
        )
        key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
        return ":".join(key_parts)

    def __call__(self, key_fn: Optional[Callable[..., str]] = None):
        """Decorator that caches function results using the provided key function."""
        if key_fn is None:
            key_fn = self._default_key_fn

        def decorator(func: Callable[..., T]) -> Callable[..., T]:
            @functools.wraps(func)
            def wrapper(*args, **kwargs) -> T:
                cache_key = key_fn(*args, **kwargs)
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

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
default_file_cache = FileCache(cache_dir=ROOT_DIR / "cache")
