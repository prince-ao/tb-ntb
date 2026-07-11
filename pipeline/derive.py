"""Per-metro field derivation — pure, stdlib only."""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping

from .errors import SlugCollisionError

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slug(name: str) -> str:
    """URL-safe deep-link key from a metro name: lowercase, runs of non-alphanumerics
    collapsed to single hyphens, no leading/trailing hyphen. ``"Austin, TX" -> "austin-tx"``.

    @spec PIPE-PROC-010
    """
    return _NON_ALNUM.sub("-", name.lower()).strip("-")


def state_of(row: Mapping[str, str]) -> str:
    """Two-letter USPS code from Zillow's ``StateName`` column — never by parsing
    ``RegionName`` (a multi-state CBSA like ``"Kansas City, MO-KS"`` must still yield one code).

    @spec PIPE-PROC-009
    """
    return str(row["StateName"]).strip().upper()


def assert_unique_slugs(slugs: Iterable[str]) -> None:
    """Raise :class:`SlugCollisionError` if any slug repeats — a collision fails the run
    rather than silently renaming a metro (deep links must stay stable).

    @spec PIPE-QUAL-004
    """
    seen: set[str] = set()
    for s in slugs:
        if s in seen:
            raise SlugCollisionError(f"duplicate slug: {s!r}")
        seen.add(s)
