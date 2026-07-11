"""Shared fixtures. The contract lives at repo-root ``contract/``."""

import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT = REPO_ROOT / "contract"


@pytest.fixture(scope="session")
def schema() -> dict:
    return json.loads((CONTRACT / "metros.schema.json").read_text())


@pytest.fixture(scope="session")
def sample() -> dict:
    """The committed v4 fixture — a valid contract document PIPE must be able to reproduce."""
    return json.loads((CONTRACT / "metros.sample.json").read_text())


@pytest.fixture
def fake_zhvi_csv() -> str:
    """A minimal wide Zillow CSV: metadata columns + two month columns, msa geography,
    integer-typed RegionID."""
    return (
        'RegionID,SizeRank,RegionName,RegionType,StateName,2026-05-31,2026-06-30\n'
        '394913,0,"Austin, TX",msa,TX,449000,450000\n'
        '753899,1,"San Francisco, CA",msa,CA,1149000,1150000\n'
    )


@pytest.fixture
def authored_defaults() -> dict:
    """TEST values only — NOT the real product defaults (those are the user's to supply)."""
    return {
        "downPaymentFraction": 0.2,
        "insuranceRate": 0.005,
        "maintenanceRate": 0.01,
        "closingCostRate": 0.03,
        "sellingCostRate": 0.06,
        "horizonYears": 10,
        "investmentReturn": 0.06,
        "appreciationSpread": 0.01,
        "rentGrowthSpread": 0.01,
        "refiRateDropThreshold": 0.01,
        "refiCostRate": 0.02,
        "securityDepositMonths": 1.0,
        "applicationFee": 50.0,
    }
