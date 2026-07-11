# EARS Specs — Financial Model (MODEL)

> **Status: revised — model-amortized payment (from the loan term), renter upfront costs, full per-year output.**
> Traces to `agent-docs/llds/financial-model.md`. IDs are stable; retired IDs
> (PROC-002/003/004/005/007, LOAN-001/002/008) are not reused.

## Projection & output (MODEL-PROC)

- [x] **MODEL-PROC-001**: The system shall compute, for each year from 1 to `horizonYears`, the buyer's and renter's financial position, returning exactly `horizonYears` results indexed by a 1-based `year`.
- [x] **MODEL-PROC-006**: The model shall perform no I/O and shall return identical output for identical input.
- [x] **MODEL-PROC-008**: The system shall compute a year's buyer net worth as home equity — the end-of-year price times `(1 − sellingCostRate)`, minus the outstanding loan balance — plus the buyer's investment account.
- [x] **MODEL-PROC-009**: The system shall compute a year's renter net worth as the renter's investment account plus the recoverable security deposit.
- [x] **MODEL-PROC-010**: The system shall start both agents from identical cash `homeValue · (downPaymentFraction + closingCostRate)`; the buyer's investment account starts at zero; the renter's starts at that cash minus the security deposit and the application fee.
- [x] **MODEL-PROC-011**: For each year, the system shall add the difference in housing outflow to the investment account of whichever agent spent less, then grow both investment accounts by `investmentReturn`.
- [x] **MODEL-PROC-012**: The system shall charge the buyer's property tax, insurance, and maintenance for a year on that year's end-of-year home price.
- [x] **MODEL-PROC-013**: The system shall compute the buyer's housing outflow for a year as the mortgage paid (while a balance remains) plus any refinance cost plus property tax, insurance, and maintenance; and the renter's housing outflow as that year's rent.
- [x] **MODEL-PROC-014**: The system shall compute each year's result independently of `horizonYears` — a given year's values shall be identical for any horizon at or beyond that year.
- [x] **MODEL-PROC-015**: The system shall report, for each year: home price, loan balance, mortgage paid, home equity, buyer investments, buyer net worth, annual rent, renter investments, renter deposit, and renter net worth.
- [x] **MODEL-PROC-016**: The system shall treat the security deposit (`securityDepositMonths · monthlyRent`) as a recoverable asset added to renter net worth every year and never invested; the application fee shall be sunk at the start.
- [x] **MODEL-PROC-017**: The system shall report, on the projection, the scheduled monthly mortgage payment it amortized (`Projection.monthlyPayment`).

## Rate trajectories (MODEL-RATE)

- [x] **MODEL-RATE-001**: The system shall compute inflation in year `t` as a mean reversion from the current reading `i₀` (`currentInflation`) toward a fixed 2% anchor — `inflation_t = 0.02 + (i₀ − 0.02) · DECAY^t`, where `DECAY = 0.5^(1/7)` (a 7-year half-life). The anchor and decay are fixed model constants; inflation is not user-adjustable.
- [x] **MODEL-RATE-002**: If the derived mortgage market rate is below zero, then the system shall use zero.
- [x] **MODEL-RATE-003**: The system shall derive nominal appreciation as `inflation_t + appreciationSpread` and nominal rent growth as `inflation_t + rentGrowthSpread`, rather than taking either as a direct input.
- [x] **MODEL-RATE-004**: If a year's appreciation or rent-growth rate is at or below −100%, then the system shall floor that year's price or rent growth multiplier at zero, so home price and rent never fall below zero.
- [x] **MODEL-RATE-005**: The system shall compound the home price from `homeValue` over years 1..t, and the annual rent from `12 · monthlyRent` over years 1..(t − 1).
- [x] **MODEL-RATE-006**: The system shall derive the mortgage market rate used for the refinance decision as `inflation_t + (m₀ − i₀)`, where `m₀` is the origination rate and `i₀` the current inflation reading; the premium `(m₀ − i₀)` is frozen at origination.

## Loan & refinancing (MODEL-LOAN)

- [x] **MODEL-LOAN-003**: The system shall set the buyer's annual mortgage payment by amortizing the initial loan (`homeValue · (1 − downPaymentFraction)`) at the origination rate `mortgageRate` over `loanTermYears` — annual compounding, `loan·m₀ / (1 − (1+m₀)^(−n))`, or `loan / n` when `m₀ = 0` — and hold it fixed for the life of the loan; a refinance changes the interest rate but not the payment.
- [x] **MODEL-LOAN-004**: When, in a year with an outstanding balance, the derived mortgage market rate is at least `refiRateDropThreshold` below the current locked rate, the system shall refinance — re-lock at the market rate (lowering interest going forward) and charge `refiCostRate · balance` as a cash outflow that year; the payment is unchanged.
- [x] **MODEL-LOAN-005**: The system shall allow a refinance to occur in more than one year of a single projection.
- [x] **MODEL-LOAN-006**: While the loan balance is zero, the system shall charge no mortgage payment.
- [x] **MODEL-LOAN-007**: The system shall evolve the loan balance each year as `max(0, balance + interest − payment)`, where `interest = balance · rate` and the payment is capped at the amount due (`balance + interest`), so the buyer never pays more than owed.

## Input validation (MODEL-VAL)

- [x] **MODEL-VAL-001**: If any input falls outside its documented domain (LLD § Preconditions & validation), then the system shall throw a `RangeError` and shall not produce a projection.
