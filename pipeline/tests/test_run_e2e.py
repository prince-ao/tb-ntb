"""End-to-end run over local fixture sources (no network) — exercises the full
fetch→reshape→join→assemble→validate→write path and the run report (contract v5)."""

import json
from pathlib import Path

import pytest

from pipeline.run import run

REPO = Path(__file__).resolve().parents[2]
SCHEMA = REPO / "contract" / "metros.schema.json"
TAX = REPO / "pipeline" / "config" / "state_tax_rates.yaml"

ZHVI = (
    "RegionID,SizeRank,RegionName,RegionType,StateName,2025-06-30,2026-06-30\n"
    '394913,0,"Austin, TX",msa,TX,440000,450000\n'
    '753899,1,"San Francisco, CA",msa,CA,1140000,1150000\n'
)
ZORI = (
    "RegionID,SizeRank,RegionName,RegionType,StateName,2025-06-30,2026-06-30\n"
    '394913,0,"Austin, TX",msa,TX,1800,1850\n'
    '753899,1,"San Francisco, CA",msa,CA,3300,3400\n'
)
def _write_pmms_xlsx(path) -> None:
    """A minimal Freddie-PMMS-shaped xlsx: preamble, 3-row header, weekly 30/15-yr FRM."""
    import pandas as pd

    rows = [
        [None, None, "PRIMARY MORTGAGE MARKET SURVEY", None, None],
        [None, None, None, None, None],
        [None, None, None, None, None],
        [None, None, None, None, None],
        [None, "U.S.", "30 yr", "U.S.", "15 yr"],
        [None, "30 yr", "fees &", "15 yr", "fees &"],
        ["Week", "FRM", "points", "FRM", "points"],
        [pd.Timestamp("2026-06-20"), 6.75, 0.6, 6.05, 0.5],
        [pd.Timestamp("2026-06-27"), 6.80, 0.6, 6.10, 0.5],
    ]
    pd.DataFrame(rows).to_excel(path, header=False, index=False, engine="openpyxl")

# A complete v5 authored-defaults set (13 fields; test values, not the production config).
AUTHORED_V5 = {
    "downPaymentFraction": 0.20,
    "insuranceRate": 0.004,
    "maintenanceRate": 0.02,
    "closingCostRate": 0.03,
    "sellingCostRate": 0.08,
    "horizonYears": 12,
    "investmentReturn": 0.10,
    "appreciationSpread": 0.005,
    "rentGrowthSpread": 0.01,
    "refiRateDropThreshold": 0.01,
    "refiCostRate": 0.03,
    "securityDepositMonths": 1.5,
    "applicationFee": 75,
}


def _bls_json() -> str:
    data = [{"year": "2025", "period": f"M{m:02d}", "value": str(300.0 + (m - 1))} for m in range(1, 13)]
    data.append({"year": "2026", "period": "M01", "value": "306.0"})  # YoY = 306/300 - 1 = 0.02
    return json.dumps({"Results": {"series": [{"seriesID": "CUUR0000SA0", "data": data}]}})


def _write_config(tmp_path) -> Path:
    yaml = pytest.importorskip("yaml")
    pytest.importorskip("openpyxl")
    (tmp_path / "zhvi.csv").write_text(ZHVI)
    (tmp_path / "zori.csv").write_text(ZORI)
    _write_pmms_xlsx(tmp_path / "pmms.xlsx")
    (tmp_path / "bls.json").write_text(_bls_json())
    (tmp_path / "defaults.yaml").write_text(yaml.safe_dump(AUTHORED_V5))
    config = {
        "schema_version": "5.0.0",
        "sources": {
            "home_values": {"kind": "wide_csv", "url": str(tmp_path / "zhvi.csv")},
            "rents": {"kind": "wide_csv", "url": str(tmp_path / "zori.csv")},
            "mortgage_rate": {"kind": "single_value", "url": str(tmp_path / "pmms.xlsx")},
            "inflation": {"kind": "yoy_rate", "url": str(tmp_path / "bls.json")},
            "property_tax": {"kind": "per_state_lookup", "path": str(TAX), "asOf": "2024"},
            "defaults": {"kind": "static_values", "path": str(tmp_path / "defaults.yaml")},
        },
    }
    cfg = tmp_path / "sources.yaml"
    cfg.write_text(yaml.safe_dump(config))
    return cfg


# @spec PIPE-PROC-002, PIPE-DEF-001, PIPE-DEF-002, PIPE-DEF-003, PIPE-DEF-004, PIPE-PROC-004
def test_run_end_to_end_produces_valid_file(tmp_path):
    pytest.importorskip("pandas")
    pytest.importorskip("jsonschema")
    cfg = _write_config(tmp_path)
    out = tmp_path / "metros.json"

    report = run(str(cfg), str(SCHEMA), str(out))

    assert report.final_n == 2
    assert report.mortgage_rate == {"30": pytest.approx(0.068), "15": pytest.approx(0.061)}
    assert report.current_inflation == pytest.approx(0.02)

    doc = json.loads(out.read_text())
    assert doc["schemaVersion"] == "5.0.0"
    assert [m["slug"] for m in doc["metros"]] == ["austin-tx", "san-francisco-ca"]  # sorted
    d = doc["defaults"]
    assert d["mortgageRate"] == {"30": pytest.approx(0.068), "15": pytest.approx(0.061)}
    assert d["currentInflation"] == pytest.approx(0.02)  # fetched, live
    assert d["downPaymentFraction"] == 0.20  # authored prior, verbatim
    assert d["applicationFee"] == 75  # renamed from rentApplicationFee in v5
    assert "loanTermYears" not in d  # dropped in v5
    austin = next(m for m in doc["metros"] if m["slug"] == "austin-tx")
    assert austin["homeValue"] == 450000 and austin["monthlyRent"] == 1850
    assert austin["propertyTaxRate"] == pytest.approx(0.01346)  # TX, from the Lincoln table
    assert "monthlyPayment" not in austin  # v5: the model amortizes; PIPE emits no payment


# @spec PIPE-QUAL-006
def test_run_drops_metro_without_rent(tmp_path):
    pytest.importorskip("pandas")
    pytest.importorskip("jsonschema")
    cfg = _write_config(tmp_path)
    # Rewrite ZORI to drop San Francisco -> it should fall out of coverage, logged.
    (tmp_path / "zori.csv").write_text(
        "RegionID,SizeRank,RegionName,RegionType,StateName,2026-06-30\n"
        '394913,0,"Austin, TX",msa,TX,1850\n'
    )
    out = tmp_path / "metros.json"
    report = run(str(cfg), str(SCHEMA), str(out))
    assert report.final_n == 1
    assert "753899" in report.drops  # SF dropped, and the reason recorded
