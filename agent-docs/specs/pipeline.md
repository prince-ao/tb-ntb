# EARS Specs — Data Pipeline (PIPE)

> Traces to `agent-docs/llds/data-pipeline.md`; built to **contract schema v5**. Segment prefix `PIPE`;
> groups `PROC`/`DEF`/`QUAL`/`OBS` are component types within the one PIPE arrow segment.
>
> **v5:** `mortgageRate` is a term-indexed object `{30,15}` (Freddie PMMS xlsx, both terms);
> `currentInflation` is observed (BLS CPI YoY); `loanTermYears` was dropped; `applicationFee` was
> renamed from `rentApplicationFee`. **The model amortizes — PIPE emits no `monthlyPayment`.** The
> interim `PIPE-RATE-*` specs are retired and replaced by `PIPE-DEF-*`.

## Configuration & run flow

- [ ] **PIPE-PROC-001**: The system shall read its sources and their reshape/join rules from `pipeline/config/sources.yaml`, not from hard-coded per-source logic.
- [ ] **PIPE-PROC-007**: Before fetching, the system (config preflight) shall fail if `schema_version` differs from the contract's `schemaVersion`, if any source `kind` has no adapter, or if any referenced committed file is missing.
- [ ] **PIPE-PROC-002**: When the ETL runs, the system shall fetch each source, reshape each wide monthly series (ZHVI, ZORI) to the latest good value per metro, join on Zillow RegionID, assemble the `defaults` block, and emit one `metros.json`.
- [ ] **PIPE-PROC-003**: When joining, the system shall include a metro only if it has a home value, a rent, and a property-tax rate for its primary state in the 50-state table (DC/PR/territories excluded, per `PIPE-OBS-002`).
- [ ] **PIPE-PROC-009**: When deriving fields, the system shall take `state` from Zillow's `StateName` column (not by parsing `RegionName`).
- [ ] **PIPE-PROC-010**: When deriving fields, the system shall build `slug` from `name` (lowercase; runs of non-alphanumerics → single hyphens).
- [ ] **PIPE-PROC-004**: Before writing, the system shall validate the assembled object (metros + `defaults`) against `contract/metros.schema.json` and fail on nonconformance.
- [ ] **PIPE-PROC-008**: When emitting, the system shall order `metros[]` by `slug` so unchanged data yields an unchanged file except `generatedAt`.
- [ ] **PIPE-PROC-005**: If a source is unavailable or its fetch fails, then the system shall fail the run and emit no file (last good stays live, per `PIPE-QUAL-006`).
- [ ] **PIPE-PROC-006**: The system shall run the ETL on a schedule via GitHub Actions and support manual dispatch.
- [ ] **PIPE-PROC-011**: The system shall expose a CLI (`python -m pipeline --out <path>`) that runs the pipeline, prints the run report, writes a schema-valid `metros.json`, and exits non-zero on any failure.
- [ ] **PIPE-PROC-012**: After a successful run, the system shall publish `metros.json` by committing it back to the repo (commit-back delivery).

## The `defaults` block (v5)

- [ ] **PIPE-DEF-001**: When emitting, the system shall include the required `defaults` object populated with every field the v5 schema defines.
- [ ] **PIPE-DEF-002**: The system shall fill the 13 authored defaults (`downPaymentFraction`, `insuranceRate`, `maintenanceRate`, `closingCostRate`, `sellingCostRate`, `horizonYears`, `investmentReturn`, `appreciationSpread`, `rentGrowthSpread`, `refiRateDropThreshold`, `refiCostRate`, `securityDepositMonths`, `applicationFee`) verbatim from committed `pipeline/config/defaults.yaml`; it shall not guess or compute these values.
- [ ] **PIPE-DEF-003**: The system shall fill `defaults.mortgageRate` as `{ "30", "15" }` from the current observed 30-yr and 15-yr Freddie Mac PMMS rates, as decimals (each `6.80`% → `0.068`).
- [ ] **PIPE-DEF-004**: The system shall fill `defaults.currentInflation` from observed BLS CPI data (`CUUR0000SA0`), computed as the latest year-over-year change (a decimal; may be negative).
- [ ] **PIPE-DEF-005**: The system shall not emit fixed model constants, any model output or derived readout, or a per-metro `monthlyPayment` — those live in MODEL / are computed in the browser (the model amortizes).

## Data-quality gates & failure model

- [ ] **PIPE-QUAL-001**: While reshaping a `wide_csv` source, the system shall require its metadata columns, keep only `RegionType == "msa"` rows (failing if none remain — a wrong-geography file — so the "United States" aggregate row is dropped), and require `RegionID` unique among them.
- [ ] **PIPE-QUAL-002**: When selecting a metro's latest home value or rent, the system shall pick the most recent month that is non-null and within the plausibility band; a metro with no qualifying month is dropped via coverage.
- [ ] **PIPE-QUAL-003**: If an observed global rate is missing or out of band (`defaults.mortgageRate.{30,15}` outside (0, 1]; `defaults.currentInflation` outside [-0.05, 0.25]), then the system shall fail the run.
- [ ] **PIPE-QUAL-007**: If any committed value is outside its schema bound at config load (a tax rate outside [0, 0.05], or any `defaults.yaml` field outside its v5 range), then the system shall fail the run.
- [ ] **PIPE-QUAL-004**: If deriving `slug` yields a value already used by another metro in the same run, then the system shall fail the run rather than silently renaming.
- [ ] **PIPE-QUAL-005**: When writing output, the system shall write atomically (temp file promoted via `os.replace` only after validation) so a crash mid-write cannot corrupt the published file.
- [ ] **PIPE-QUAL-006**: If a run fails at any gate, then the system shall emit no file, leave the previously published `metros.json` untouched, and never re-emit prior data under a new `generatedAt`.

## Observability — run report

- [ ] **PIPE-OBS-001**: On every run, the system shall log per-stage counts (fetched, usable ZHVI, usable ZORI, joined, tax-resolved, final N).
- [ ] **PIPE-OBS-002**: When the system excludes a metro, it shall log its RegionID and the reason (missing ZORI/ZHVI, no state rate incl. DC/PR/territory, implausible value).
- [ ] **PIPE-OBS-003**: When a metro spans multiple states, the system shall log the metro and the primary state whose tax rate was applied.
- [ ] **PIPE-OBS-004**: If the final metro count falls anomalously below the previous run, then the system shall surface a prominent warning (threshold TBD).

## Open
- Confirm the PMMS `.xlsx` sheet/column layout on the first smoke-run. Route to APP: mark
  `defaults.mortgageRate` as observed, not a dial. SCHEMA tidy: `data-contract.md` retired
  `PIPE-RATE-*` refs.
