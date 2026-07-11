# EARS Specs — Data Contract (SCHEMA)

> Specs for the `metros.json` contract artifact and its invariants. These describe *what the
> file is*; who validates it and when is owned by PIPE (producer), INFRA (CI), and APP (reader).
> IDs are stable — added, never renumbered or reused.

## The contract file

- [x] **SCHEMA-DATA-001**: The system shall define the shape of `metros.json` as a JSON Schema at `contract/metros.schema.json`.
- [x] **SCHEMA-DATA-002**: The `metros.json` file shall carry only the model's inputs — per-metro observed facts, the global `defaults` block of assumption defaults, and source provenance — and shall not carry model outputs (e.g. net-worth arrays) or derived values (e.g. price-to-rent, which the app computes).
- [x] **SCHEMA-DATA-004**: The committed sample fixture (`contract/metros.sample.json`) shall validate against `contract/metros.schema.json`.

## Per-metro record

- [x] **SCHEMA-DATA-003**: Each metro record shall contain the required fields `slug`, `regionId`, `name`, `state`, `homeValue`, `monthlyRent`, and `propertyTaxRate`. (Stated as required, not exhaustive — additive-only evolution may add optional fields later.)
- [x] **SCHEMA-DATA-007**: Every metro listed in the file shall be complete — all required fields present, none null. (Metros lacking any input are excluded by the pipeline's coverage rule — PIPE-PROC-003 — never included with gaps.)
- [x] **SCHEMA-DATA-011**: Each metro's `slug` shall be unique within the file and URL-safe (match `^[a-z0-9-]+$`), and is the shareable deep-link key (`?metro=<slug>`). (Generating the slug from a metro's city and state is a PIPE responsibility.)

## File-level invariants

- [x] **SCHEMA-DATA-008**: The file shall contain at least one metro. (A run that would yield zero metros is a failed run, not an emitted empty file — see PIPE-PROC-003.)
- [x] **SCHEMA-DATA-009**: The file shall include, for each of home values, rents, mortgage rate, and property tax, a provenance entry giving the source name and its as-of date.
- [x] **SCHEMA-DATA-010**: Per-metro rate fields (`propertyTaxRate`) shall be expressed as decimals; monetary fields (`homeValue`, `monthlyRent`) as whole US dollars; date fields (`generatedAt`) as ISO 8601 (`YYYY-MM-DD`). *(v1's top-level `mortgageRate30yr` is removed in v2 — its value moved to `defaults.mortgageRate.level`; the `defaults` rate/type rules are `-013`/`-014`.)*

## The `defaults` block (assumption defaults — v2; joint sub-contract with MODEL)

- [x] **SCHEMA-DATA-012**: The file shall carry a top-level `defaults` object, present and complete, holding every assumption default: `downPaymentFraction`, `insuranceRate`, `maintenanceRate`, `closingCostRate`, `sellingCostRate`, `horizonYears`, `investmentReturn`, `appreciationSpread`, `rentGrowthSpread`, `refiRateDropThreshold`, `refiCostRate`, `securityDepositMonths`, `applicationFee`, `currentInflation`, and `mortgageRate`. (These field names are a joint sub-contract with the MODEL segment.)
- [x] **SCHEMA-DATA-013**: `defaults.currentInflation` shall be a scalar decimal (may be negative — deflation; no upper bound). `defaults.mortgageRate` shall be an object keyed by term — `"30"` and `"15"` — each a decimal ≥ 0 (today's 30-yr and 15-yr origination rates); the app flattens to the chosen preset and the model amortizes the payment itself.
- [x] **SCHEMA-DATA-015**: `defaults.securityDepositMonths` shall be a number ≥ 0 (the renter's deposit in months of rent; the deposit is `securityDepositMonths × monthlyRent`, recoverable) and `defaults.applicationFee` shall be a number ≥ 0 (a flat USD sunk fee).
- [x] **SCHEMA-DATA-014**: In `defaults`, fraction fields (`downPaymentFraction`, `insuranceRate`, `maintenanceRate`, `closingCostRate`, `sellingCostRate`, `investmentReturn`) shall be decimals within [0, 1]; cost/threshold fields (`refiRateDropThreshold`, `refiCostRate`) shall be non-negative decimals; spread fields (`appreciationSpread`, `rentGrowthSpread`) shall be decimals (may be negative); and `horizonYears` shall be a positive integer.

## Owned elsewhere (cross-segment — listed for traceability, specced in their own files)

Resolved intent from the SCHEMA audits, to become specs in those segments:

- Producer validation before emit → **PIPE-PROC-004**.
- CI validation of the fixture → **INFRA-PROC-005**.
- App validates the **whole file against the schema on load**, and shows an error state on any
  failure (missing/mistyped field, empty `metros`, unparseable, or incompatible version) → **APP**.
- App treats only a **major** `schemaVersion` mismatch as incompatible; it tolerates unknown/extra
  fields and minor/patch bumps (additive-only forward-compat) → **APP**.
- App uses `slug` as the deep-link key, seeds its UI dials from the *adjustable* defaults only
  (**not** `inflation`, which is model-determined), expects `schemaVersion` major **3**, and shows
  per-source `asOf` (not `generatedAt`) in the honesty strip → **APP**.
- **PIPE must emit `defaults` with `inflation`/`mortgageRate` as scalars and bump to 3.0.0** (the v2
  *and* v3 cascades are both owed; its LLD is still on v1) → **PIPE** (required cascade).
- **MODEL** must make `Assumptions.inflation`/`.mortgageRate` scalars and owns the fixed constants
  (2% anchor, convergence, mortgage premium) + the derived mortgage path; plus the v2 `Metro` fix
  (`priceToRent` → `slug`) → **MODEL**.
