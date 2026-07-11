"""Observed global-rate transforms — pure, stdlib only."""

from __future__ import annotations

from collections.abc import Sequence


def pmms_to_decimal(percent: float) -> float:
    """PMMS publishes a percent (``6.80``); the contract carries a decimal (``0.068``).

    @spec PIPE-DEF-003
    """
    return float(percent) / 100.0


def inflation_yoy(monthly_index: Sequence[tuple[str, float]]) -> float:
    """Year-over-year inflation from the BLS CPI index (``CUUR0000SA0``): the latest month's
    index divided by the same month one year earlier, minus one — a decimal (may be negative).
    ``monthly_index`` is ``[("YYYY-MM", index), ...]`` in chronological order and must span the
    current-and-prior-year window (>= 13 observations, with the prior-year month present).

    @spec PIPE-DEF-004
    """
    obs = list(monthly_index)
    if len(obs) < 13:
        raise ValueError(f"need >= 13 monthly observations for YoY, got {len(obs)}")
    by_period = dict(obs)
    latest_period, latest_value = obs[-1]
    year, month = latest_period.split("-")
    prior_period = f"{int(year) - 1}-{month}"
    if prior_period not in by_period:
        raise ValueError(f"missing prior-year month {prior_period} for YoY")
    return float(latest_value) / float(by_period[prior_period]) - 1.0
