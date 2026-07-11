"""The orchestrator: preflight → fetch → reshape → join → assemble → validate → atomic write,
plus the run report. Any failure raises a `PipelineError` and publishes nothing."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

from . import CONTRACT_VERSION, adapters, coverage, derive, quality, rates
from .build import assemble, load_defaults, validate, write_atomic
from .config import load_config, preflight
from .errors import DataQualityError, PipelineError

REGISTERED_KINDS = frozenset(
    {"wide_csv", "single_value", "yoy_rate", "per_state_lookup", "static_values"}
)


@dataclass
class RunReport:
    """Per-stage counts + drop reasons, logged every run so a silent regression can't hide.

    @spec PIPE-OBS-001, PIPE-OBS-002, PIPE-OBS-003
    """

    fetched: int = 0
    usable_zhvi: int = 0
    usable_zori: int = 0
    joined: int = 0
    tax_resolved: int = 0
    final_n: int = 0
    drops: dict[str, str] = field(default_factory=dict)  # regionId -> reason
    multi_state: dict[str, str] = field(default_factory=dict)  # regionId -> primary state
    mortgage_rate: dict[str, float] | None = None  # {"30": .., "15": ..}
    current_inflation: float | None = None

    def format(self) -> str:
        lines = [
            f"fetched={self.fetched} usableZHVI={self.usable_zhvi} usableZORI={self.usable_zori} "
            f"joined={self.joined} taxResolved={self.tax_resolved} finalN={self.final_n}",
            f"mortgageRate={self.mortgage_rate} currentInflation={self.current_inflation} "
            f"multiState={len(self.multi_state)}",
        ]
        for rid, reason in sorted(self.drops.items()):
            lines.append(f"  drop {rid}: {reason}")
        return "\n".join(lines)


def run(config_path: str, schema_path: str, out_path: str) -> RunReport:
    """Run the full pipeline and write a schema-valid ``metros.json`` to ``out_path``.
    On any failure, raise a :class:`PipelineError` and leave the previously published file
    untouched (no partial or stale re-emit).

    @spec PIPE-PROC-002, PIPE-PROC-005, PIPE-QUAL-006, PIPE-OBS-001
    """
    try:
        return _run(config_path, schema_path, out_path)
    except PipelineError:
        raise
    except Exception as exc:  # any leak becomes a visible run failure; nothing is published
        raise PipelineError(f"{type(exc).__name__}: {exc}") from exc


def _run(config_path: str, schema_path: str, out_path: str) -> RunReport:
    config = load_config(config_path)
    preflight(config, CONTRACT_VERSION, REGISTERED_KINDS, os.path.exists)
    srcs = config["sources"]

    zhvi_text = adapters.fetch(srcs["home_values"]["url"])
    homes = adapters.reshape_wide_csv(zhvi_text, "homeValue")
    meta = adapters.metadata(zhvi_text)
    zhvi_asof = adapters.latest_month(zhvi_text)

    zori_text = adapters.fetch(srcs["rents"]["url"])
    rents = adapters.reshape_wide_csv(zori_text, "monthlyRent")
    zori_asof = adapters.latest_month(zori_text)

    # v5: both PMMS terms (from the .xlsx) -> defaults.mortgageRate.{30,15}. The model amortizes.
    pmms_date, r30_pct, r15_pct = adapters.pmms_latest(adapters.fetch_bytes(srcs["mortgage_rate"]["url"]))
    mortgage_rate = {"30": rates.pmms_to_decimal(r30_pct), "15": rates.pmms_to_decimal(r15_pct)}

    bls_url = srcs["inflation"]["url"]
    if bls_url.startswith("http"):  # BLS API: fetch current + prior year so YoY has >= 13 months
        yr = datetime.now(timezone.utc).year
        sep = "&" if "?" in bls_url else "?"
        bls_url = f"{bls_url}{sep}startyear={yr - 1}&endyear={yr}"
    current_inflation = rates.inflation_yoy(adapters.parse_bls(adapters.fetch(bls_url)))

    tax = adapters.per_state_lookup(srcs["property_tax"]["path"])
    priors = load_defaults(srcs["defaults"]["path"])

    # Observed globals must be plausible (a structural failure, not a per-metro drop).
    for term, r in mortgage_rate.items():
        if not quality.in_band("mortgageRate", r):
            raise DataQualityError(f"implausible {term}-yr mortgage rate: {r}")
    if not quality.in_band("inflation", current_inflation):
        raise DataQualityError(f"implausible inflation: {current_inflation}")

    state_by_region = {rid: m["state"] for rid, m in meta.items()}
    cov = coverage.intersect(homes, rents, state_by_region, tax)

    metros: list[dict] = []
    multi_state: dict[str, str] = {}
    for rid in cov.included:
        name, state = meta[rid]["name"], meta[rid]["state"]
        suffix = name.rsplit(",", 1)[-1].strip() if "," in name else ""
        if "-" in suffix:  # e.g. "Kansas City, MO-KS" -> primary state took the rate
            multi_state[rid] = state
        metros.append(
            {
                "slug": derive.slug(name),
                "regionId": rid,
                "name": name,
                "state": state,
                "homeValue": homes[rid],
                "monthlyRent": rents[rid],
                "propertyTaxRate": tax[state],
            }
        )
    derive.assert_unique_slugs([m["slug"] for m in metros])

    sources_prov = {
        "homeValues": {"name": "Zillow ZHVI", "asOf": zhvi_asof},
        "rents": {"name": "Zillow ZORI", "asOf": zori_asof},
        "mortgageRate": {"name": "Freddie Mac PMMS", "asOf": pmms_date},
        "propertyTax": {
            "name": "Lincoln Institute (50-State Property Tax Comparison Study)",
            "asOf": str(srcs["property_tax"].get("asOf", "")),
        },
    }
    defaults = {**priors, "mortgageRate": mortgage_rate, "currentInflation": current_inflation}
    generated_at = datetime.now(timezone.utc).date().isoformat()
    obj = assemble(CONTRACT_VERSION, generated_at, sources_prov, defaults, metros)

    with open(schema_path) as f:
        schema = json.load(f)
    validate(obj, schema)  # last gate before any bytes are published
    write_atomic(obj, out_path)

    return RunReport(
        fetched=4,
        usable_zhvi=len(homes),
        usable_zori=len(rents),
        joined=len(cov.included),
        tax_resolved=len(cov.included),
        final_n=len(metros),
        drops=cov.drops,
        multi_state=multi_state,
        mortgage_rate=mortgage_rate,
        current_inflation=current_inflation,
    )
