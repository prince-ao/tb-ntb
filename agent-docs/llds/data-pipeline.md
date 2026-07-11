# Data Pipeline (PIPE)

> **Built to contract schema v5** (`contract/metros.schema.json`).

## Context & design philosophy

A config-driven ETL that emits **one static `metros.json` per run** (v5) — the data seam to the app.
It is the file's **sole writer** and computes **no model math** (amortization lives in MODEL). Design:
**pure core, I/O at the edges** — logic is dependency-free; pandas/HTTP live only in `adapters`. Runs
on a GitHub Actions cron for $0; PIPE owns its execution. It discovers coverage (ZHVI ∩ ZORI ∩ a
50-state tax rate), fails loud, writes atomically, and commits `metros.json` back to the repo.

## What it emits (v5)

- **Per-metro observed facts:** `slug, regionId, name, state, homeValue, monthlyRent, propertyTaxRate`.
- **Global `defaults` block:** 13 **authored priors** (from `defaults.yaml`) + 2 **observed** values —
  `mortgageRate` = `{ "30": .., "15": .. }` (Freddie PMMS, both terms) and `currentInflation`
  (BLS CPI year-over-year). `loanTermYears` was dropped in v5; `applicationFee` was renamed from
  `rentApplicationFee`.
- **`sources`** provenance for the four fetched/tabled inputs.
- **Not emitted:** model constants, model outputs, or a per-metro `monthlyPayment` — **the model
  amortizes** (v5 superseded the earlier "amortization → PIPE" idea).

## Source registry (`sources.yaml`)

| `kind` | source → target |
|---|---|
| `wide_csv` | Zillow ZHVI, ZORI (smoothed metro CSVs) → `homeValue`, `monthlyRent` |
| `single_value` | Freddie Mac PMMS **`historicalweeklydata.xlsx`** → `defaults.mortgageRate.{30,15}` (read via `pandas.read_excel`; 30-yr & 15-yr FRM) |
| `yoy_rate` | BLS CPI `CUUR0000SA0` → `defaults.currentInflation` (fetch current+prior year; latest YoY) |
| `per_state_lookup` | Lincoln Institute 50-state tax table → `propertyTaxRate` |
| `static_values` | `defaults.yaml` (13 authored priors — user-supplied, never guessed) |

Config preflight (before any fetch): `schema_version` matches the contract, every `kind` has an
adapter, every referenced committed file exists.

## Stages

`fetch → reshape` (latest non-null in-band month per metro) `→ join` on Zillow RegionID `→ coverage`
`→ assemble` (defaults + metros sorted by slug) `→ validate` (schema) `→ atomic write → commit-back`.

## Data-quality gates & failure model

Never publish a partial/invalid/implausible file; leave the last good one live. **Structural**
failures (fetch fail; missing metadata column; no `msa` rows after filtering; duplicate `RegionID`; slug
collision; a missing observed global rate; schema-invalid) fail the run. **Plausibility** bands
(home 10k–20M; rent 200–50k; mortgage (0,1]; inflation −0.05..0.25; tax 0–0.05) — a per-metro
out-of-band month is skipped; an out-of-band global or committed value fails the run. **Coverage
misses** are not failures — the metro is dropped and logged. Writes are **atomic** (temp +
`os.replace`); no stale re-emit under a new date.

## Observability — run report

Per-stage counts (fetched → usable ZHVI → usable ZORI → joined → tax-resolved → final N), every
dropped RegionID with a reason (incl. DC/PR/territory), the multi-state metros and the primary
state each took, and the observed rates with their as-of dates. Warns/fails on an anomalous drop
ratio vs. the prior run.

## Execution & publish (`.github/workflows/etl.yml`)

Weekly cron + manual dispatch → `python -m pipeline --out metros.json` → **commit-back**
(`git add/commit/push metros.json`, `permissions: contents: write`). Delivery = **commit-back**
(`PIPE-PROC-012`). *(Where the app reads it from, and whether a data refresh triggers a redeploy,
is a PIPE↔APP follow-up once APP's build exists.)*

## Decisions & open items

- Pipeline writes the `defaults` block (v5); fixed constants live in MODEL; `mortgageRate` observed
  for **both terms** `{30,15}`; `currentInflation` observed (BLS YoY, fetched/live); authored priors
  are **user-supplied, not guessed**; property tax per-state (Lincoln, 50 states; DC/territories
  excluded and logged); **no `monthlyPayment`** — the model amortizes.
- **PMMS is an `.xlsx`** — the adapter reads it with `pandas.read_excel` (needs `openpyxl`); confirm
  the sheet/column layout (30-yr & 15-yr FRM) on the first smoke-run.
- Deferred specs: `PIPE-QUAL-007` (committed-value bound checks), `PIPE-OBS-004` (drop-ratio anomaly).
- SCHEMA tidy (cross-segment): `agent-docs/llds/data-contract.md` still cites the retired `PIPE-RATE-*`.

## References
`contract/metros.schema.json` (v5) · `pipeline/` · Zillow ZHVI/ZORI · Freddie Mac PMMS · BLS CPI
`CUUR0000SA0` · Lincoln Institute 50-State Property Tax Comparison Study · `agent-docs/specs/pipeline.md`.
