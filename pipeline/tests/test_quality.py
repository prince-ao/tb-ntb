import pytest

from pipeline.quality import in_band, pick_latest_good


# @spec PIPE-QUAL-002, PIPE-QUAL-003
@pytest.mark.parametrize(
    "kind,value,ok",
    [
        ("homeValue", 450_000, True),
        ("homeValue", 12, False),  # parse/units bug — implausibly small
        ("homeValue", 50_000_000, False),  # implausibly large
        ("monthlyRent", 1850, True),
        ("mortgageRate", 0.068, True),
        ("mortgageRate", 6.8, False),  # percent not divided by 100
        ("inflation", 0.03, True),
        ("inflation", -0.10, False),  # deflation beyond the guardrail
    ],
)
def test_in_band(kind, value, ok):
    assert in_band(kind, value) is ok


# @spec PIPE-QUAL-002
def test_pick_latest_good_skips_trailing_null_and_implausible():
    series = [
        ("2026-04", 448_000),
        ("2026-05", 450_000),
        ("2026-06", None),  # revised/blank trailing month
        ("2026-07", 5),  # implausible
    ]
    assert pick_latest_good(series, "homeValue") == 450_000


# @spec PIPE-QUAL-002
def test_pick_latest_good_none_when_no_qualifying_month():
    series = [("2026-05", None), ("2026-06", 12)]
    assert pick_latest_good(series, "homeValue") is None
