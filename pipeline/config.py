"""Config loading + preflight."""

from __future__ import annotations

from collections.abc import Callable, Mapping

from .errors import ConfigError


def load_config(path: str) -> dict:
    """Load ``sources.yaml`` into a dict.

    @spec PIPE-PROC-001
    """
    import yaml

    with open(path) as f:
        return yaml.safe_load(f)


def preflight(
    config: Mapping,
    contract_version: str,
    registered_kinds: frozenset[str],
    file_exists: Callable[[str], bool],
) -> None:
    """Fail (raise :class:`ConfigError`) before any fetch if any of:
    ``config["schema_version"]`` != ``contract_version``; a source's ``kind`` is not in
    ``registered_kinds``; a referenced committed file does not exist per ``file_exists``.

    @spec PIPE-PROC-007
    """
    declared = config.get("schema_version")
    if declared != contract_version:
        raise ConfigError(
            f"config schema_version {declared!r} != contract {contract_version!r}"
        )
    for name, src in (config.get("sources") or {}).items():
        kind = src.get("kind")
        if kind not in registered_kinds:
            raise ConfigError(f"source {name!r}: unregistered kind {kind!r}")
        path = src.get("path")
        if path is not None and not file_exists(path):
            raise ConfigError(f"source {name!r}: committed file not found: {path}")
