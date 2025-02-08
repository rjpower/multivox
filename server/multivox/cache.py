import functools
import hashlib
import json
from pathlib import Path
from typing import Callable, Optional, TypeVar

T = TypeVar('T')

class FileCache:
    """File system based cache that stores JSON-serializable results."""

    def __init__(self, cache_dir: str):
        """Initialize cache with specified directory."""
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, key: str) -> Path:
        """Generate cache file path from key using MD5 hash."""
        hash_key = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{hash_key}.json"

    def _default_key_fn(*args, **kwargs) -> str:
        """Default key function that concatenates string representations of all args."""
        key_parts = [str(arg) for arg in args]
        key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
        return ":".join(key_parts)

    def __call__(self, key_fn: Optional[Callable[..., str]] = None):
        """Decorator that caches function results using the provided key function."""
        if key_fn is None:
            key_fn = self._default_key_fn
            
        def decorator(func: Callable[..., T]) -> Callable[..., T]:
            @functools.wraps(func)
            def wrapper(*args, **kwargs) -> T:
                # Generate cache key
                cache_key = key_fn(*args, **kwargs)
                cache_path = self._get_cache_path(cache_key)

                if cache_path.exists():
                    return json.loads(cache_path.read_text())

                result = func(*args, **kwargs)
                cache_path.write_text(json.dumps(result))
                return result
            return wrapper
        return decorator
