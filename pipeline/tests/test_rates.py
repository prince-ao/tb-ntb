import pytest

from pipeline.rates import inflation_yoy, pmms_to_decimal


# @spec PIPE-DEF-003
def test_pmms_percent_to_decimal():
    assert pmms_to_decimal(6.80) == pytest.approx(0.068)


# @spec PIPE-DEF-004
def test_inflation_yoy_latest_over_same_month_prior_year():
    # 13 monthly observations: 2025-01..2025-12, then 2026-01.
    series = [(f"2025-{m:02d}", 309.0 + m) for m in range(1, 13)] + [("2026-01", 315.0)]
    prior = dict(series)["2025-01"]  # same month, one year earlier
    latest = dict(series)["2026-01"]
    assert inflation_yoy(series) == pytest.approx(latest / prior - 1)


# @spec PIPE-DEF-004
def test_inflation_yoy_requires_full_year():
    with pytest.raises(ValueError):
        inflation_yoy([("2026-01", 315.0)])  # < 13 months
