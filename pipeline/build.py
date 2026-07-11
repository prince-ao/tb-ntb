"""Assemble the contract object, validate it, write it atomically."""

from __future__ import annotations

import json
import os
import tempfile
from collections.abc import Mapping, Sequence

from .errors import SchemaValidationError


def load_defaults(path: str) -> dict:
    """Serialize the 12 user-authored priors from ``defaults.yaml`` verbatim. The pipeline
    never guesses these values (they are the user's to supply).

    @spec PIPE-DEF-002
    """
    import yaml

    with open(path) as f:
        return yaml.safe_load(f)


def assemble(
    schema_version: str,
    generated_at: str,
    sources: Mapping,
    defaults: Mapping,
    metros: Sequence[Mapping],
) -> dict:
    """Build the v4 contract object: the required ``defaults`` block and ``metros`` sorted by
    ``slug`` (so unchanged data yields an unchanged file except ``generatedAt``).

    @spec PIPE-DEF-001, PIPE-PROC-008
    """
    return {
        "schemaVersion": schema_version,
        "generatedAt": generated_at,
        "sources": dict(sources),
        "defaults": dict(defaults),
        "metros": sorted((dict(m) for m in metros), key=lambda m: m["slug"]),
    }


def validate(obj: Mapping, schema: Mapping) -> None:
    """Validate the fully assembled object against the v4 schema; raise
    :class:`SchemaValidationError` on any nonconformance.

    @spec PIPE-PROC-004
    """
    import jsonschema

    try:
        jsonschema.validate(instance=obj, schema=schema)
    except jsonschema.ValidationError as e:
        raise SchemaValidationError(e.message) from e


def write_atomic(obj: Mapping, path: str) -> None:
    """Write JSON to a temp file and ``os.replace`` it into ``path`` — never write ``path``
    directly — so a crash mid-write cannot corrupt the published file.

    @spec PIPE-QUAL-005
    """
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".metros-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(obj, f, indent=2)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
