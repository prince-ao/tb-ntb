import json
from pathlib import Path

import pytest

from pipeline import adapters
from pipeline.errors import DataQualityError


# @spec PIPE-PROC-002, PIPE-QUAL-002
def test_reshape_wide_csv_picks_latest(fake_zhvi_csv):
    pytest.importorskip("pandas")
    assert adapters.reshape_wide_csv(fake_zhvi_csv, "homeValue") == {
        "394913": 450000.0,
        "753899": 1150000.0,
    }


# @spec PIPE-QUAL-001
def test_reshape_rejects_non_msa():
    pytest.importorskip("pandas")
    bad = (
        "RegionID,SizeRank,RegionName,RegionType,StateName,2026-06-30\n"
        '1,0,"Somewhere, TX",county,TX,100000\n'
    )
    with pytest.raises(DataQualityError):
        adapters.reshape_wide_csv(bad, "homeValue")


# @spec PIPE-QUAL-001
def test_reshape_rejects_duplicate_region_id():
    pytest.importorskip("pandas")
    bad = (
        "RegionID,SizeRank,RegionName,RegionType,StateName,2026-06-30\n"
        '1,0,"A, TX",msa,TX,100000\n'
        '1,1,"B, CA",msa,CA,200000\n'
    )
    with pytest.raises(DataQualityError):
        adapters.reshape_wide_csv(bad, "homeValue")


# @spec PIPE-PROC-009
def test_metadata_uses_statename(fake_zhvi_csv):
    pytest.importorskip("pandas")
    assert adapters.metadata(fake_zhvi_csv)["394913"] == {"name": "Austin, TX", "state": "TX"}


# @spec PIPE-DEF-003
def test_pmms_latest_from_xlsx(tmp_path):
    pd = pytest.importorskip("pandas")
    pytest.importorskip("openpyxl")
    rows = [  # mirrors Freddie's historicalweeklydata.xlsx: preamble, 3-row header, then weeks
        [None, None, "PRIMARY MORTGAGE MARKET SURVEY", None, None],
        [None, None, None, None, None],
        [None, None, None, None, None],
        [None, None, None, None, None],
        [None, "U.S.", "30 yr", "U.S.", "15 yr"],
        [None, "30 yr", "fees &", "15 yr", "fees &"],
        ["Week", "FRM", "points", "FRM", "points"],
        [pd.Timestamp("2000-01-05"), 8.00, 0.5, None, None],  # 15-yr not published yet -> skipped
        [pd.Timestamp("2026-06-20"), 6.75, 0.6, 6.05, 0.5],
        [pd.Timestamp("2026-06-27"), 6.80, 0.6, 6.10, 0.5],
    ]
    p = tmp_path / "pmms.xlsx"
    pd.DataFrame(rows).to_excel(p, header=False, index=False, engine="openpyxl")
    date, r30, r15 = adapters.pmms_latest(p.read_bytes())
    assert date == "2026-06-27"
    assert r30 == pytest.approx(6.80)
    assert r15 == pytest.approx(6.10)


# @spec PIPE-DEF-004
def test_parse_bls_sorts_and_drops_annual():
    payload = {
        "Results": {
            "series": [
                {
                    "seriesID": "CUUR0000SA0",
                    "data": [
                        {"year": "2026", "period": "M03", "value": "-"},  # not yet released
                        {"year": "2026", "period": "M02", "value": "308.0"},
                        {"year": "2026", "period": "M13", "value": "999.0"},  # annual avg
                        {"year": "2026", "period": "M01", "value": "307.0"},
                    ],
                }
            ]
        }
    }
    assert adapters.parse_bls(json.dumps(payload)) == [("2026-01", 307.0), ("2026-02", 308.0)]


# @spec PIPE-PROC-002
def test_per_state_lookup_committed_table_is_50_states():
    pytest.importorskip("yaml")
    path = Path(__file__).resolve().parents[1] / "config" / "state_tax_rates.yaml"
    table = adapters.per_state_lookup(str(path))
    assert len(table) == 50
    assert table["TX"] == pytest.approx(0.01346)
    assert "DC" not in table  # 50 states only
