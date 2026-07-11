"""Source adapters (fetch + reshape). pandas and `requests` are imported lazily inside the
functions so the pure pipeline core imports without them.

@spec PIPE-PROC-002, PIPE-QUAL-001, PIPE-DEF-003
"""

from __future__ import annotations

import csv
import io
from datetime import datetime

from .errors import DataQualityError
from .quality import pick_latest_good

_WIDE_CSV_META = {"RegionID", "RegionName", "RegionType", "StateName"}
_UA = {"User-Agent": "Mozilla/5.0 (tb-ntb ETL)"}


def _is_date(s: str) -> bool:
    for fmt in ("%Y-%m-%d", "%Y-%m"):
        try:
            datetime.strptime(str(s), fmt)
            return True
        except ValueError:
            continue
    return False


def fetch(url: str) -> str:
    """Return the text at ``url`` (CSV/JSON sources). Local paths are read for tests; anything
    else is an HTTP GET. Any failure propagates (a structural run failure). @spec PIPE-PROC-005"""
    if url.startswith("file://"):
        with open(url[len("file://") :], encoding="utf-8") as f:
            return f.read()
    if "://" not in url:
        with open(url, encoding="utf-8") as f:
            return f.read()
    import requests

    resp = requests.get(url, timeout=60, headers=_UA)
    resp.raise_for_status()
    return resp.text


def fetch_bytes(url: str) -> bytes:
    """Return the raw bytes at ``url`` (binary sources, e.g. the PMMS `.xlsx`). @spec PIPE-DEF-003"""
    if url.startswith("file://"):
        with open(url[len("file://") :], "rb") as f:
            return f.read()
    if "://" not in url:
        with open(url, "rb") as f:
            return f.read()
    import requests

    resp = requests.get(url, timeout=60, headers=_UA)
    resp.raise_for_status()
    return resp.content


def reshape_wide_csv(csv_text: str, value_kind: str) -> dict[str, float]:
    """A wide monthly Zillow CSV → ``{regionId: latest_good_value}``. Identifies month columns
    by parseable-date header; asserts the metadata columns are present, ``RegionType == "msa"``,
    and ``RegionID`` unique; casts ``RegionID`` to ``str``; picks the latest non-null, in-band
    month per metro. @spec PIPE-PROC-002, PIPE-QUAL-001, PIPE-QUAL-002"""
    import pandas as pd

    df = pd.read_csv(io.StringIO(csv_text), dtype={"RegionID": str})
    missing = _WIDE_CSV_META - set(df.columns)
    if missing:
        raise DataQualityError(f"wide_csv missing metadata columns: {sorted(missing)}")
    # Zillow's metro file carries a "United States" (country) aggregate row atop the metros —
    # keep only msa rows. Zero msa rows means a wrong-geography file (a real failure).
    df = df[df["RegionType"].astype(str) == "msa"]
    if df.empty:
        raise DataQualityError("wide_csv has no 'msa' rows (wrong geography file?)")
    if df["RegionID"].duplicated().any():
        raise DataQualityError("wide_csv has a duplicate RegionID")
    month_cols = [c for c in df.columns if _is_date(c)]
    out: dict[str, float] = {}
    for _, row in df.iterrows():
        series = [(c, None if pd.isna(row[c]) else float(row[c])) for c in month_cols]
        value = pick_latest_good(series, value_kind)
        if value is not None:
            out[str(row["RegionID"])] = value
    return out


def metadata(csv_text: str) -> dict[str, dict[str, str]]:
    """Per-metro identity from a wide Zillow CSV: ``{regionId: {"name", "state"}}`` (state from
    the ``StateName`` column). @spec PIPE-PROC-009"""
    import pandas as pd

    df = pd.read_csv(io.StringIO(csv_text), dtype={"RegionID": str})
    df = df[df["RegionType"].astype(str) == "msa"]  # drop the "United States" aggregate row
    out: dict[str, dict[str, str]] = {}
    for _, row in df.iterrows():
        rid = str(row["RegionID"])
        out[rid] = {"name": str(row["RegionName"]), "state": str(row["StateName"]).strip().upper()}
    return out


def latest_month(csv_text: str) -> str:
    """The most recent date-parseable column header in a wide CSV (used for source `asOf`)."""
    header = next(csv.reader(io.StringIO(csv_text)))
    months = [c for c in header if _is_date(c)]
    return max(months) if months else ""


def pmms_latest(xlsx_bytes: bytes) -> tuple[str, float, float]:
    """Latest ``(date, rate30_percent, rate15_percent)`` from the Freddie Mac PMMS
    ``historicalweeklydata.xlsx`` ("Full History" sheet: preamble rows, a multi-row header ending
    in a ``Week`` row, then weekly data with 30-yr and 15-yr FRM columns). Columns are located by
    their header text (not a fixed index); returns the most recent week that has *both* rates
    (the 15-yr series starts later than the 30-yr, so early rows lack it). @spec PIPE-DEF-003"""
    import pandas as pd

    df = pd.read_excel(io.BytesIO(xlsx_bytes), sheet_name=0, header=None)
    week_row = next(
        (i for i in range(min(25, len(df))) if str(df.iat[i, 0]).strip().lower() == "week"), None
    )
    if week_row is None:
        raise DataQualityError("PMMS xlsx: 'Week' header row not found")
    labels: dict[int, str] = {}
    for c in range(df.shape[1]):
        parts = [str(df.iat[r, c]).strip() for r in range(max(0, week_row - 2), week_row + 1)]
        labels[c] = " ".join(p for p in parts if p.lower() not in ("nan", "")).lower()

    def col(term: str) -> int:
        for c, lab in labels.items():
            if term in lab and "frm" in lab and "fees" not in lab and "spread" not in lab:
                return c
        raise DataQualityError(f"PMMS xlsx: no '{term} FRM' column (headers={labels})")

    c30, c15 = col("30 yr"), col("15 yr")
    for _, row in df.iloc[week_row + 1 :].iloc[::-1].iterrows():
        try:
            r30, r15 = float(row[c30]), float(row[c15])
        except (ValueError, TypeError):
            continue
        if r30 == r30 and r15 == r15:  # both non-NaN
            wk = row[0]
            date = wk.date().isoformat() if hasattr(wk, "date") else str(wk)
            return (date, r30, r15)
    raise DataQualityError("PMMS xlsx: no week with both 30- and 15-yr FRM")


def parse_bls(json_text: str) -> list[tuple[str, float]]:
    """BLS API v2 response → ``[("YYYY-MM", index), ...]`` chronological, keeping only monthly
    (M01–M12) observations. @spec PIPE-DEF-004"""
    import json

    payload = json.loads(json_text)
    rows = payload["Results"]["series"][0]["data"]
    obs: list[tuple[str, float]] = []
    for r in rows:
        period = str(r["period"])
        if not (period.startswith("M") and period[1:].isdigit() and 1 <= int(period[1:]) <= 12):
            continue  # skip M13 (annual average) and any non-monthly
        try:
            value = float(r["value"])
        except (ValueError, TypeError):
            continue  # BLS returns "-" (or blank) for periods with no data released yet
        obs.append((f"{r['year']}-{int(period[1:]):02d}", value))
    obs.sort(key=lambda x: x[0])
    return obs


def per_state_lookup(path: str) -> dict[str, float]:
    """Load the committed per-state tax table → ``{STATE: rate}``. @spec PIPE-PROC-002"""
    import yaml

    with open(path) as f:
        data = yaml.safe_load(f)
    return {str(k).strip().upper(): float(v) for k, v in data.items()}
