# Financial Model (MODEL)

> **Status: revised — model-amortized payment (from the loan term), upfront costs, full output.**
> Interface (`packages/model/src/index.ts`) is agreed with this doc. Math is specified here and in
> `agent-docs/specs/model.md`.

## Context and Design Philosophy

The engine. A pure function of `(metro facts, assumptions)` producing, for each year of the
horizon, the **full financial picture of both paths** — home price, loan balance, equity, the
mortgage paid, both investment accounts, the rent, the deposit, and each side's net worth. It no
longer hides its work behind two summary numbers. No I/O; deterministic; cheap enough to run on
every slider move.

**What it deliberately is not:** no income tax, hence no deductions (HLD Non-Goals). Property tax
*is* a cash carrying cost. It computes no "breakeven"/winner — where the lines cross is a no-math
comparison the app does.

## Inputs

**Metro facts** (from the contract, mirrored in `Metro`): `homeValue` (P₀), `monthlyRent` (R₀),
`propertyTaxRate`.

**Assumptions** (most seeded from `metros.json`'s `defaults`). User dials: `downPaymentFraction`,
**`loanTermYears`** (the amortization term — the app's 30/15 toggle; app-side, not in the contract),
insurance/maintenance/closing/selling rates, `horizonYears`, `investmentReturn`, the two
appreciation/rent spreads, the two refinancing parameters, **`securityDepositMonths`** (renter, in
months of rent), **`applicationFee`** (renter, flat USD). Market inputs (not dials): `mortgageRate`
(`m₀`, the origination rate — used to **amortize the payment**, accrue interest, and drive refi) and
`currentInflation` (`i₀`). **There is no `monthlyPayment` input:** the model amortizes it from the
initial loan, `m₀`, and `loanTermYears` (see the loan mechanic), and reports it on the `Projection`.
The frontend exposes no payment or income field. PIPE emits no `monthlyPayment` — it already asserts
"the model amortizes."

> Field names mirror SCHEMA's `defaults`. `loanTermYears` is the exception — an app-side dial; the
> contract ships term-indexed `mortgageRate.{30,15}` and the app passes the selected scalar rate plus
> the term.

## Preconditions & validation

The model **validates and throws** `RangeError` on out-of-domain input.

| Input | Domain |
|---|---|
| `homeValue`, `monthlyRent` | `> 0` |
| `propertyTaxRate`, `insuranceRate`, `maintenanceRate`, `closingCostRate`, `sellingCostRate`, `refiCostRate` | `≥ 0` |
| `applicationFee`, `securityDepositMonths` | `≥ 0` |
| `downPaymentFraction` | `[0, 1]` |
| `horizonYears`, `loanTermYears` | integer `≥ 1` |
| `investmentReturn` | `> −1` |
| `refiRateDropThreshold` | `> 0` |
| `mortgageRate` (`m₀`) | `≥ 0` |
| `currentInflation`, `appreciationSpread`, `rentGrowthSpread` | any real |

## Rate trajectories

Unchanged. Inflation is a fixed model law mean-reverting to a 2% anchor; the mortgage market rate
(refi only) rides it.

Constants (in the model, not `metros.json`): `INFLATION_ANCHOR = 0.02`,
`INFLATION_DECAY = 0.5^(1/7) ≈ 0.9057` (7-yr half-life).

```
inflation_t      = 0.02 + (i₀ − 0.02) · INFLATION_DECAY^t
mortgageMarket_t = max(0, inflation_t + (m₀ − i₀))     # premium (m₀−i₀) frozen; floored at 0
appreciation_t   = inflation_t + appreciationSpread
rentGrowth_t     = inflation_t + rentGrowthSpread
```
Price/rent growth multipliers are floored at 0 (`max(0, 1 + rate)`) — appreciation may be negative,
but a home or rent is never worth < $0.

## Method (net-worth comparison)

Two agents from the **same starting cash** `buyerCash = P₀·(downPaymentFraction + closingCostRate)`:

- **Buyer** sinks it into the purchase (down payment + closing); side account starts at 0.
- **Renter** pays their upfront costs from it — a **security deposit** (`securityDepositMonths ×
  R₀`, *recoverable*) and an **application fee** (*sunk*) — and invests the rest. The deposit sits
  idle (no growth) but is a recoverable asset; the fee is gone.

```
deposit    = securityDepositMonths · R₀        # set at signing, on the initial rent
renterAcct = buyerCash − deposit − applicationFee
buyerAcct  = 0
```

Each year, whoever's housing outflow is lower invests the difference; both accounts compound at
`investmentReturn`. Net worth "if you exit at year t":

- `buyerNetWorth_t = homeEquity_t + buyerAcct_t`, `homeEquity_t = price_t·(1 − sellingCostRate) − balance_t`
- `renterNetWorth_t = renterAcct_t + deposit` — the deposit is recovered on exit **every** year (mirrors the buyer's selling costs applied every year); it never earns a return.

### Loan mechanic (payment is amortized from the term)

`loan₀ = P₀·(1 − downPaymentFraction)`. The annual payment is **amortized once at origination** from
the initial loan, the origination rate `m₀`, and the term `loanTermYears` (`n`), then held fixed:

```
annualPayment = (m₀ == 0) ? loan₀ / n : loan₀·m₀ / (1 − (1 + m₀)^(−n))
```

Annual compounding — it matches the model's annual interest step, so a loan carried its full term
pays off in exactly `n` years. Each year:

```
interest = balance · rate
due      = balance + interest
pAndI    = (balance > 0) ? min(annualPayment, due) : 0    # never pay more than owed; 0 once paid off
balance  = due − pAndI                                     # ≥ 0; monotonically decreases (see below)
```

An amortized payment always exceeds the first year's interest, so the balance only ever falls —
**negative amortization can no longer occur** (it was reachable only when the payment was an
arbitrary user input). The loan pays off when `balance` reaches 0 — by year `n` if the horizon
reaches it, with the final year's payment capped at the amount due.

### Timing conventions

- `price_t = P₀ · Π_{k=1..t} max(0, 1 + appreciation_k)`; carrying costs (tax+ins+maint) on `price_t`.
- `rent_t = 12·R₀ · Π_{k=1..t-1} max(0, 1 + rentGrowth_k)` (today's rent in year 1).
- Surplus invested at start of year (earns that year's return).

### The recurrence

```
# setup
balance    = P₀ · (1 - downPaymentFraction)
rate       = m₀                                      # origination; used to accrue interest
annualPay  = amortize(balance, m₀, loanTermYears)    # annual amortization at origination; held fixed
monthlyPay = annualPay / 12                          # reported on the Projection
buyerCash  = P₀ · (downPaymentFraction + closingCostRate)
deposit    = securityDepositMonths · R₀
renterAcct = buyerCash - deposit - applicationFee
buyerAcct  = 0
price      = P₀
rent       = 12 · R₀

for t in 1..H:
    inflation_t = 0.02 + (i₀ - 0.02)·INFLATION_DECAY^t

    # 1. refinance: lower the RATE only (payment stays fixed); charge cost
    market = max(0, inflation_t + (m₀ - i₀))
    refiCost = 0
    if balance > 0 and market < rate and (rate - market) >= refiRateDropThreshold:
        rate     = market
        refiCost = refiCostRate · balance

    # 2. price (before carrying costs read it)
    price = price · max(0, 1 + inflation_t + appreciationSpread)

    # 3. outflows
    interest     = balance · rate
    due          = balance + interest
    pAndI        = (balance > 0) ? min(annualPay, due) : 0
    carrying     = (tax + insuranceRate + maintenanceRate)·price
    buyerOutflow = pAndI + refiCost + carrying
    renterOutflow = rent

    # 4. whoever spends less invests the difference; both accounts grow
    diff = buyerOutflow - renterOutflow
    if diff > 0: renterAcct += diff  else: buyerAcct += -diff
    buyerAcct  *= (1 + investmentReturn)
    renterAcct *= (1 + investmentReturn)

    # 5. update balance (floors at 0 on payoff; amortized payment ⇒ no neg-am)
    balance = due - pAndI

    # 6. record the FULL year
    homeEquity = price·(1 - sellingCostRate) - balance
    emit {
      year: t, homePrice: price, loanBalance: balance, mortgagePaid: pAndI, homeEquity,
      buyerInvestments: buyerAcct, buyerNetWorth: homeEquity + buyerAcct,
      annualRent: rent, renterInvestments: renterAcct, renterDeposit: deposit,
      renterNetWorth: renterAcct + deposit
    }

    rent = rent · max(0, 1 + inflation_t + rentGrowthSpread)   # next year's rent

return { years, monthlyPayment: monthlyPay }                   # payment reported alongside the years
```

### Invariants (assert in tests)

1. **Identical start:** `renterAcct₀ = buyerCash − deposit − applicationFee`, `buyerAcct₀ = 0`.
2. **`balance ≥ 0`** and **monotonically non-increasing** — an amortized payment always covers the year's interest, so negative amortization cannot occur; the balance floors at 0 on payoff (by year `n`).
3. **`price ≥ 0`, `rent ≥ 0`** (multiplier floor).
4. **Deposit** is added to renter net worth at every year `t`, never invested.
5. **Horizon independence:** every year's outputs depend only on `t` and prior state — no step reads `H`.

## Refinancing

If the market rate falls at least `refiRateDropThreshold` below the locked rate, the buyer
refinances: re-lock at the market rate (lower interest going forward), pay `refiCostRate · balance`
in cash. **The payment does not change** (it stays the origination-amortized payment) — so the benefit is faster payoff /
less interest, not a smaller bill. Can recur.

## Interface

`project(metro, assumptions) → { years: YearProjection[], monthlyPayment }`, validating inputs.
`Projection.monthlyPayment` is the scheduled monthly P&I the model amortized (for the app's itemized
readout — no separate helper is exported). `YearProjection` carries the full per-year picture:
`year, homePrice, loanBalance, mortgagePaid, homeEquity, buyerInvestments, buyerNetWorth, annualRent,
renterInvestments, renterDeposit, renterNetWorth`. `Assumptions` swaps the old `monthlyPayment` input
for **`loanTermYears`**; field names otherwise mirror the contract `defaults` — the joint sub-contract
with SCHEMA.

## Decisions & Alternatives

| Decision | Chosen | Alternatives | Rationale |
|---|---|---|---|
| Output | **Full per-year components** (price, balance, equity, payment, both accounts, rent, deposit, both net worths) | Two net-worth numbers | User wants the model to show its work, not hide it. |
| Monthly payment | **Amortized by the model** (loan + `m₀` + `loanTermYears`) | User-set payment; derived by PIPE; derived by the app | The frontend exposes no payment (or income) field — the payment follows from the term, not a dial. Amortizing in the model makes it the sole owner and matches what PIPE/SCHEMA already assert. |
| Loan term | **`loanTermYears` is the dial** (app's 30/15 toggle) | A payment dial; a single fixed term | The term is the intuitive lever; the payment is its consequence. |
| Payment exposure | **Reported on `Projection.monthlyPayment`** | Exported amortization helper; recomputed in the app | One field, no second public function, no formula duplicated in the app. |
| Refi with a fixed payment | **Lower the rate only** (faster payoff) | Recompute/lower the payment; remove refi | Preserves the amortized payment while keeping the real rate-drop benefit. |
| Renter upfront | Deposit (recoverable, uninvested, recovered each exit-year) + application fee (sunk) | No renter upfront; deposit invested; deposit only at final year | Symmetric starting cash; recovering the deposit each year preserves horizon-independence. |

## Open Questions & Future Decisions

1. **`investmentReturn` drift** — flat scalar; add drift?
2. **Annual vs. monthly amortization** — the model amortizes annually (matching its annual interest
   step); a true monthly-compounding schedule differs by a few dollars. Deliberately not modeled.
3. **Horizon past payoff** — `horizonYears` (12) is below the shortest term (15), so the loan never
   pays off within the horizon today. Post-payoff years are already fair: once `pAndI` hits 0 the
   buyer's outflow drops below the renter's and the "invest the difference" mechanic banks the freed
   cash flow automatically. **If `horizonYears` becomes user-adjustable or extends past the term,
   re-examine this** — the fairness rests on that difference-investing step continuing to run.

*Un-retired:* `loanTermYears` returns as a MODEL input — the amortization term. *Retired:* the
exogenous `monthlyPayment` input and the "payment is the user's dial" framing; the payment is
amortized by the model and reported on the `Projection`.

## References
- `artifacts/rent-vs-buy-mvp-spec.md § 6`, `agent-docs/specs/model.md`, `agent-docs/high-level-design.md`.
