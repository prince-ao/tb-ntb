# Data Contract (SCHEMA)

> **Status: SCHEMA v5.0.0 complete.** v5 (MODEL-driven): `defaults.mortgageRate` is now term-indexed
> `{ "30", "15" }` (the app flattens to the chosen preset); `loanTermYears` is dropped; `inflation` →
> `currentInflation`, `rentApplicationFee` → `applicationFee`. **`monthlyPayment` is NOT stored** — the
> model amortizes it (it's derived from home value + down payment + rate; storing it would go stale as
> dials move). All `agent-docs/specs/schema.md` specs `[x]`, verified by `contract/metros.test.ts`.
> **Cascade:** MODEL owns the payment computation and reads the term from the preset; PIPE emits the
> new shape. **PIPE conforms to SCHEMA (confirmed authority).**

## Context and Design Philosophy

The one narrow interface between the pipeline and the app. Its value is that both sides build
against it independently — so the goal is *stability and unambiguity*, not richness.

Two principles, updated for shape B:

1. **Inputs, not outputs.** The file carries the model's *inputs* — per-metro observed facts **and**
   the global per-run **defaults** — plus provenance. It does **not** carry model outputs
   (net-worth arrays, breakeven) or derived values (price-to-rent); those are computed in the browser.
   *(Per-run inputs belong in the file so it is the single writer; every default-case result reproduces
   from the file **plus the model's published constants** (v3) — per the HLD's "one file, one writer.")*
2. **One source of truth.** A value that can be derived is not also stored. The app and model author
   no numbers of their own — they read the defaults and let the user override them as dials.

## The shape (v3.0.0)

Authoritative: `contract/metros.schema.json`. Fixture: `contract/metros.sample.json`.

| Field | Type | Meaning | Notes |
|---|---|---|---|
| `schemaVersion` | string (semver) | Version of this contract | **3.0.0** — consumers check the major |
| `generatedAt` | date | When the pipeline produced the file | UTC |
| `sources` | object | Provenance per input (`name`, `asOf`) | Powers the honest "as of" strip |
| `defaults` | object | The model's per-run inputs (see below) | v5: `mortgageRate` term-indexed `{30,15}`; `currentInflation` scalar |
| `metros[]` | array | Covered metros (per-metro facts) | Order not guaranteed (app sorts) |

**v3 change:** `defaults.inflation` and `defaults.mortgageRate` collapse from `{level, rateOfChange}`
objects to **scalars**; the `driftingRate` and `mortgageRateDefault` `$defs` are deleted. *(v2 had
already removed the top-level `mortgageRate30yr`; the rate now lives in `defaults.mortgageRate`.)*

**`metros[]` entries are unchanged from v1** — `slug`, `regionId`, `name`, `state`, `homeValue`,
`monthlyRent`, `propertyTaxRate`. *(Confirmed: keep the current shape — `slug`, no `priceToRent`.
The task text and MODEL's `Metro` type say `priceToRent`/no-`slug`; MODEL's mirror is reconciled to
the contract — see cross-segment.)*

## The `defaults` block (the model's per-run inputs — joint sub-contract with MODEL)

A single top-level object holding the model's per-run inputs. Most are **user-overridable dials**; a
couple are **not dialable** — `inflation` (the current reading, whose trajectory is a fixed model law)
and, by convention, the mortgage origination rate. The pipeline writes every value; the app seeds its
dials from the adjustable ones. **The field names are an agreed sub-contract with the MODEL segment**,
whose `Assumptions` mirrors this block.

**All scalars (v3):**

| Field | Default | Meaning |
|---|---|---|
| `downPaymentFraction` | 0.20 | Fraction of price paid up front |
| `insuranceRate` | 0.005 | Annual insurance, fraction of home value |
| `maintenanceRate` | 0.010 | Annual maintenance, fraction of home value |
| `closingCostRate` | 0.03 | Purchase closing costs, fraction of price |
| `sellingCostRate` | 0.06 | Selling costs, fraction of sale price |
| `horizonYears` | 10 | Projection horizon |
| `investmentReturn` | 0.06 | Return on invested capital (renter's opportunity cost) |
| `appreciationSpread` | 0.01 | Home appreciation = `inflation`ₜ + this spread |
| `rentGrowthSpread` | 0.01 | Rent growth = `inflation`ₜ + this spread |
| `refiRateDropThreshold` | 0.01 | Refinance when the market rate falls this far below the locked rate |
| `refiCostRate` | 0.02 | Cost of a refinance, fraction of the balance |
| `securityDepositMonths` | 1.5 | Renter's deposit in months of rent; deposit = this × `monthlyRent`. Recoverable. |
| `applicationFee` | 50 | Flat renter application fee (USD). Sunk (non-recoverable). |
| `currentInflation` | 0.02 | **Scalar.** Current inflation reading. Non-dialable — the model gravitates it to a fixed 2% anchor over the horizon. |
| `mortgageRate` | `{ "30", "15" }` | **Term-indexed (v5).** Today's 30-yr and 15-yr origination rates; the app flattens to the chosen preset. The model amortizes the payment itself. |

**Fixed constants live in MODEL, not the file (decision B).** The 2% inflation anchor, the
convergence/gravity speed, and the mortgage premium are model constants — laws, identical every run
and every metro. Consequence: a default-case result reproduces from the file **together with the
model's published constants** — honest because the client-side model is fully inspectable. *(This
softens the old "from the file alone"; the HLD's Success-Metrics line needs the matching one-line
reconciliation — see cross-segment.)*

*Semantics (the anchor/gravity law, appreciation = inflation + spread, the mortgage-from-inflation
path, refi) are MODEL's to interpret; SCHEMA carries only these scalars.*

## Invariants

- **No nulls, no partial metros.** A metro is emitted only if it has every required field (PIPE
  coverage rule). *(unchanged from v1)*
- **Non-empty.** `metros` has ≥ 1 item; a zero-metro run is a failed run. *(unchanged)*
- **`slug` is unique + URL-safe**, the deep-link key. *(unchanged; generation is a PIPE concern)*
- **`defaults` is present and complete.** Bounds: `currentInflation` scalar (may be negative —
  deflation, no upper bound); `mortgageRate` is a `{ "30", "15" }` object, each term ≥ 0; `horizonYears`
  integer ≥ 1; fractions in [0, 1]; costs/thresholds ≥ 0; spreads signed. *(SCHEMA owns these bounds;
  PIPE fills the values within them.)*
- **Units are fixed conventions:** rates/fractions are decimals (`0.017`, not `1.7`); money is whole
  USD; dates are ISO `YYYY-MM-DD`; `horizonYears` is a positive integer.
- **US-only scope.** No currency/locale field.

## Evolution & compatibility

Additive-only within a major version; the app tolerates unknown fields. **The current version is
`5.0.0`** — v5 reshaped `mortgageRate` to a term-indexed `{ "30", "15" }` object, dropped
`loanTermYears`, and renamed two fields (all breaking). (v4 added the renter-upfront-cost fields; v3
collapsed the rates to scalars.) Per the policy, a major bump is a **coordinated cascade**: PIPE emits
`5.0.0`, and APP must expect major 5 (its version guard errors on a major mismatch). These are cascades
fanning out — flagged for PIPE, APP, and MODEL below.

## Consumption

- **Pipeline (writer):** validates output against the schema before emit; `additionalProperties: false`
  gates the producer. **Sole generator** of `metros.json`, including the `defaults` block.
- **App (reader):** validates the whole file against the schema on load, tolerating unknown fields;
  error state on any failure or a **major** version mismatch. Seeds the UI dials from `defaults` and
  lets the user override them. Uses `slug` as the deep-link key; shows per-source `asOf`.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| What the file carries | Inputs (facts + per-run defaults) + provenance | Facts only; or defaults in app code | HLD "one file, one writer": per-run inputs ride in the file; default-case results reproduce from the file **plus the model's published constants** (v3). |
| `defaults` location | A single top-level `defaults` object | Defaults spread per-metro; or in app constants | Defaults are global, not per-metro; one block keeps them cohesive and easy for the app to seed dials from. |
| Inflation & mortgage representation | **Scalars** (`inflation` = current reading, `mortgageRate` = origination) | Per-run `{level, rateOfChange}` drift (v2) | Inflation's trajectory is a fixed model law, not a user dial; the mortgage forward path is derived from inflation. The drift no longer belongs in the file. Breaking → 3.0.0. |
| Fixed constants (2% anchor, convergence, mortgage premium) | **MODEL constants, not in the file** | Non-dialable fields in the file (strict "file-alone" reproducibility) | Constants are laws — identical every run and every metro; storing per-run data for them is redundant. The client model is inspectable, so honesty holds. |
| Renter upfront costs (v4) | **`securityDepositMonths` (× rent, recoverable) + `applicationFee` (flat USD, sunk)**, required in `defaults` | Omit (rent-only renter side); per-metro fee fields | Restores buy/rent symmetry (buyer has down + closing); global dials since there's no per-metro fee data. Required → clean, complete `defaults`; major bump. |
| Term-indexed rates + payment (v5) | **`mortgageRate {30,15}` stored; `monthlyPayment` NOT stored — model amortizes** | Store `monthlyPayment {30,15}` per-metro (MODEL's ask) | Rates are observed facts (fine to store); the payment is *derived* and goes stale when a dial moves — the model already amortizes. |
| Field names in `defaults` | Agreed MODEL sub-contract | SCHEMA picks unilaterally | The model consumes these names; co-owning them avoids a rename cascade. |
| `priceToRent` | Not stored — app derives it | Emit it | *(unchanged v1 decision; see pre-flight discrepancy)* |
| `slug` identity | Human-readable, city+state | `regionId` as key | *(unchanged v1 decision)* |

## Cross-segment consequences (flagged, not propagated here)

1. **MODEL** — `Assumptions` must change `inflation` and `mortgageRate` from `DriftingRate` objects to
   **scalars**, and MODEL now **owns the constants** (2% anchor, gravity/convergence speed, mortgage
   premium) and the derived mortgage-market path. (It still owes the v2 `Metro` fix: drop `priceToRent`,
   add `slug`.) **v4:** mirror `securityDepositMonths`/`applicationFee` in `Assumptions` and fold the
   deposit (recoverable — returned at the horizon) + application fee (sunk) into the renter's starting
   cash. **v5 (MODEL-driven):** `inflation`→`currentInflation`, drop `loanTermYears` (term comes from
   the app's 30/15 preset), take `mortgageRate` as the flattened scalar for the chosen preset, and
   **amortize the monthly payment itself** — it is not stored in the contract. See the MODEL brief.
2. **APP** — must expect `schemaVersion` major **5**; seed dials from the *adjustable* defaults only —
   **`currentInflation` is not a dial** (don't expose it), nor is the mortgage forward path. On the 15/30
   preset toggle it picks `mortgageRate["30"|"15"]` and passes the scalar + term to the model. Plus the carried
   items (whole-file validation, `slug` key, `asOf`).
3. **PIPE** — sole generator; **PIPE conforms to SCHEMA (confirmed authority).** PIPE's drafted specs
   currently contradict this contract and must reconcile: `PIPE-RATE-004` calls the adjustable defaults
   "app-owned, not file contents" (they *are* the `defaults` block PIPE writes); `PIPE-RATE-003` emits
   the model constants into the file (they live in MODEL — decision B); `PIPE-RATE-001/002` use file-root
   `mortgageRate30yr`/`currentInflationRate` (→ `defaults.mortgageRate`/`defaults.inflation`, scalars).
   Net: keep the `defaults` block, emit `inflation`/`mortgageRate` as scalars, don't emit constants,
   bump to 3.0.0. Required cascade — flagged, not performed here.
4. **HLD** — Success Metrics still says "reproducible from `metros.json` **alone**"; under decision B it
   should read "**file + the model's published constants**." A one-line HLD reconciliation is owed
   (offered below — not made unilaterally).

## Open Questions & Future Decisions

### Resolved (across the v2–v3 audits)
1. `defaults` is **required and complete** — every field present, every field a **scalar** (v3).
2. `inflation` and `mortgageRate` are **scalars** (v3). `mortgageRate` ≥ 0; `inflation` may be
   negative (deflation). No upper bound on either (matches prior; avoids over-constraining a reading).
3. **Bounds:** fractions in [0, 1]; costs/thresholds ≥ 0; spreads signed; `horizonYears` integer ≥ 1.
   (`loanTermYears` was dropped in v5.) Exact values are **not** pinned — priors PIPE fills and may retune.
6. Fixed constants (2% anchor, convergence, mortgage premium) live in **MODEL**, not the file
   (decision B); reproducibility = the file + the model's published constants.
4. `sources.mortgageRate` (provenance) and `defaults.mortgageRate` (value) intentionally share a name
   — different parents, different jobs; documented, not renamed.
5. Keeping `defaults` ⟷ MODEL `Assumptions` in sync → an **INFRA** coherence check comparing the key
   sets (flagged); a documented hand-maintained sub-contract until then.

### Deferred
1. `slug` stability across a rare relabel; collision tie-break (PIPE).
2. Historical snapshots for the "metros that flipped" story.

## References
- `contract/README.md`, `agent-docs/specs/schema.md`, `agent-docs/high-level-design.md § System Design`
