"""Plausibility bands and latest-good selection — pure, stdlib only.

The band values are PROVISIONAL guardrails (deliberately loose; to confirm with the user).
They catch parse/units bugs — a $12 or $50M home, a 680% rate — not real variation.
"""

from __future__ import annotations

from collections.abc import Sequence

# Provisional plausibility bands as (low, high). Confirm with the user.
PLAUSIBILITY: dict[str, tuple[float, float]] = {
    "homeValue": (10_000.0, 20_000_000.0),
    "monthlyRent": (200.0, 50_000.0),
    "mortgageRate": (0.0, 1.0),  # low bound exclusive: a rate must be > 0
    "inflation": (-0.05, 0.25),
    "propertyTaxRate": (0.0, 0.05),
}


def in_band(kind: str, value: float) -> bool:
    """True iff ``value`` is within ``PLAUSIBILITY[kind]`` (mortgageRate's low bound is
    exclusive). Unknown ``kind`` is a programming error and raises ``KeyError``.

    @spec PIPE-QUAL-002, PIPE-QUAL-003
    """
    low, high = PLAUSIBILITY[kind]
    if kind == "mortgageRate":
        return low < value <= high
    return low <= value <= high


def pick_latest_good(series: Sequence[tuple[str, float | None]], kind: str) -> float | None:
    """Given ``[(period, value), ...]`` in chronological order, return the value of the most
    recent period that is non-null and within the ``kind`` band, else ``None`` (the metro then
    drops via coverage — this is not a failure).

    @spec PIPE-QUAL-002
    """
    for _period, value in reversed(list(series)):
        if value is not None and in_band(kind, value):
            return value
    return None
