import json
from hashlib import md5
from typing import Any, Mapping

from django.core.cache import cache


def _version_key(candidate_id: int) -> str:
    return f"jobs:cache-version:{candidate_id}"


def get_jobs_cache_version(candidate_id: int) -> int:
    """Return a per-candidate cache version for job data."""
    key = _version_key(candidate_id)
    version = cache.get(key)
    if version is None:
        cache.set(key, 1, timeout=None)
        version = 1
    return int(version)


def bump_jobs_cache_version(candidate_id: int) -> None:
    """Increment cache version to invalidate job-related caches."""
    key = _version_key(candidate_id)
    try:
        cache.incr(key)
    except Exception:
        cache.set(key, 1, timeout=None)


def build_jobs_cache_key(prefix: str, candidate_id: int, params: Mapping[str, Any]) -> str:
    """Generate a stable cache key for job queries based on params."""
    serialized = []
    for key in sorted(params.keys()):
        try:
            values = params.getlist(key)  # type: ignore[attr-defined]
        except Exception:
            values = params.get(key)
        serialized.append((key, values))
    digest = md5(json.dumps(serialized, sort_keys=True, default=str).encode('utf-8')).hexdigest()
    return f"{prefix}:{candidate_id}:v{get_jobs_cache_version(candidate_id)}:{digest}"
