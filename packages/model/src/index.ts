/**
 * @packageDocumentation
 * The rent-vs-buy financial model — the "engine" of the tool.
 *
 * This file is a SEAM: the interface the app builds against and MODEL implements. Types here are
 * an agreement; changing them ripples into APP.
 *
 * Design intent (see agent-docs/llds/financial-model.md):
 *   - Pure functions. No fetch, no DOM, no I/O. Deterministic given inputs.
 *   - Cheap enough to run on every slider move.
 *   - Output is the FULL per-year picture (prices, balances, equity, both accounts, rent, net
 *     worth) — the model shows its work, it does not hide behind two summary numbers.
 *   - Inflation is a FIXED MODEL LAW (mean-reverts to a 2% anchor), not an input; the mortgage
 *     market rate (refinance only) derives from it. Only i0 and m0 enter as market inputs.
 *   - The monthly payment is AMORTIZED by the model from the initial loan, m0, and loanTermYears,
 *     and reported on the Projection. There is no monthlyPayment input and no income input — the
 *     frontend exposes neither. The pipeline emits term-indexed rates, not a payment.
 */

/** Observed facts about one metro. Mirrors a `metros[]` entry in the data contract. */
export interface Metro {
  regionId: string;
  name: string;
  state: string;
  /** P0 — current typical home value, USD. */
  homeValue: number;
  /** R0 — current typical monthly rent, USD. */
  monthlyRent: number;
  /** Effective annual property tax rate, decimal. Modeled as a carrying cost. */
  propertyTaxRate: number;
  /** homeValue / (12 * monthlyRent). Display readout; the model does not use it. */
  priceToRent: number;
}

/**
 * Model inputs, seeded from metros.json's `defaults` block (field names mirror it — the joint
 * sub-contract with SCHEMA). Most are user dials; `mortgageRate` and `currentInflation` are market
 * inputs read from the file but not dialed.
 */
export interface Assumptions {
  /** Fraction of price paid up front, e.g. 0.20. */
  downPaymentFraction: number;
  /** Mortgage amortization term in years (the app's 30/15 toggle). The model amortizes the payment
   *  from this, the initial loan, and m0 — there is no monthlyPayment input. */
  loanTermYears: number;
  /** Annual insurance as a fraction of home value, e.g. 0.005. */
  insuranceRate: number;
  /** Annual maintenance as a fraction of home value, e.g. 0.010. */
  maintenanceRate: number;
  /** Purchase closing costs as a fraction of price, e.g. 0.03. */
  closingCostRate: number;
  /** Selling costs as a fraction of the sale price, e.g. 0.06. Applied to equity each year. */
  sellingCostRate: number;
  /** How many years to project, e.g. 10. */
  horizonYears: number;
  /** Return on invested capital (the opportunity cost), per year. Flat scalar. */
  investmentReturn: number;
  /** MARKET INPUT (not a dial): origination mortgage rate m0. Accrues interest; drives refinance. */
  mortgageRate: number;
  /** MARKET INPUT (not a dial): the current inflation reading i0. Inflation mean-reverts from i0
   *  toward a fixed 2% anchor (a model law); it is NOT user-adjustable. */
  currentInflation: number;
  /** Nominal appreciation in year t = inflation_t + appreciationSpread. Not set directly. */
  appreciationSpread: number;
  /** Nominal rent growth in year t = inflation_t + rentGrowthSpread. Not set directly. */
  rentGrowthSpread: number;
  /** Refinance when the market rate falls at least this far below the locked rate, e.g. 0.01. */
  refiRateDropThreshold: number;
  /** Refinance cost as a fraction of the outstanding balance, e.g. 0.02. Paid in cash that year. */
  refiCostRate: number;
  /** Renter's security deposit, in months of rent. Recoverable; never invested. */
  securityDepositMonths: number;
  /** Renter's application fee, flat USD. Sunk at the start. */
  applicationFee: number;
}

/** The model's full output for a single year. */
export interface YearProjection {
  /** 1-based year. */
  year: number;
  /** Home value at end of this year. */
  homePrice: number;
  /** Outstanding loan balance at end of this year. */
  loanBalance: number;
  /** Mortgage paid this year (P&I), capped at the amount due; 0 once the loan is paid off. */
  mortgagePaid: number;
  /** Home equity if sold this year: homePrice·(1 − sellingCostRate) − loanBalance. */
  homeEquity: number;
  /** Buyer's side investment account. */
  buyerInvestments: number;
  /** Buyer's net worth: homeEquity + buyerInvestments. */
  buyerNetWorth: number;
  /** Rent paid this year (annual). */
  annualRent: number;
  /** Renter's side investment account. */
  renterInvestments: number;
  /** Renter's recoverable security deposit (constant across years). */
  renterDeposit: number;
  /** Renter's net worth: renterInvestments + renterDeposit. */
  renterNetWorth: number;
}

/** The full projection for one (metro, assumptions) pair. */
export interface Projection {
  years: YearProjection[];
  /** Scheduled monthly P&I the model amortized (constant across the loan's life). */
  monthlyPayment: number;
}

/** Fixed model constants — the inflation "gravity law". Not inputs; see the LLD. */
const INFLATION_ANCHOR = 0.02;
const INFLATION_DECAY = Math.pow(0.5, 1 / 7); // 7-year half-life ≈ 0.9057

/**
 * Annual amortizing payment for a `loan` at annual rate `r` over `n` years — annual compounding, to
 * match the model's annual interest step (a loan carried its full term pays off in exactly `n`
 * years). Rate 0 → straight-line `loan / n`. Not exported: the payment is an internal derivation.
 */
function amortizeAnnual(loan: number, r: number, n: number): number {
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
}

/** Throws `RangeError` if any input is outside its documented domain (LLD § Preconditions). */
function validateInputs(metro: Metro, a: Assumptions): void {
  const req = (ok: boolean, msg: string): void => {
    if (!ok) throw new RangeError(msg);
  };
  req(metro.homeValue > 0, "homeValue must be > 0");
  req(metro.monthlyRent > 0, "monthlyRent must be > 0");
  req(metro.propertyTaxRate >= 0, "propertyTaxRate must be ≥ 0");
  req(a.downPaymentFraction >= 0 && a.downPaymentFraction <= 1, "downPaymentFraction must be in [0, 1]");
  req(Number.isInteger(a.loanTermYears) && a.loanTermYears >= 1, "loanTermYears must be an integer ≥ 1");
  req(Number.isInteger(a.horizonYears) && a.horizonYears >= 1, "horizonYears must be an integer ≥ 1");
  req(a.investmentReturn > -1, "investmentReturn must be > -1");
  req(a.refiRateDropThreshold > 0, "refiRateDropThreshold must be > 0");
  req(a.mortgageRate >= 0, "mortgageRate must be ≥ 0");
  req(a.insuranceRate >= 0, "insuranceRate must be ≥ 0");
  req(a.maintenanceRate >= 0, "maintenanceRate must be ≥ 0");
  req(a.closingCostRate >= 0, "closingCostRate must be ≥ 0");
  req(a.sellingCostRate >= 0, "sellingCostRate must be ≥ 0");
  req(a.refiCostRate >= 0, "refiCostRate must be ≥ 0");
  req(a.securityDepositMonths >= 0, "securityDepositMonths must be ≥ 0");
  req(a.applicationFee >= 0, "applicationFee must be ≥ 0");
  // currentInflation, appreciationSpread, rentGrowthSpread: any real — deflation/declines are legitimate.
}

/**
 * Project buyer vs. renter finances year by year for one metro under one set of assumptions.
 * The single entry point the app calls on every interaction. Validates its inputs and throws
 * `RangeError` on out-of-domain values. Returns the full per-year picture; the app derives any
 * crossover between the two net-worth lines.
 */
// @spec MODEL-PROC-001, MODEL-PROC-006, MODEL-PROC-008, MODEL-PROC-009, MODEL-PROC-010
// @spec MODEL-PROC-011, MODEL-PROC-012, MODEL-PROC-013, MODEL-PROC-014, MODEL-PROC-015, MODEL-PROC-016, MODEL-PROC-017
// @spec MODEL-RATE-001, MODEL-RATE-002, MODEL-RATE-003, MODEL-RATE-004, MODEL-RATE-005, MODEL-RATE-006
// @spec MODEL-LOAN-003, MODEL-LOAN-004, MODEL-LOAN-005, MODEL-LOAN-006, MODEL-LOAN-007
// @spec MODEL-VAL-001
export function project(metro: Metro, a: Assumptions): Projection {
  validateInputs(metro, a);

  const P0 = metro.homeValue;
  const i0 = a.currentInflation;
  const premium = a.mortgageRate - i0; // frozen at origination

  let balance = P0 * (1 - a.downPaymentFraction);
  let rate = a.mortgageRate; // m0; accrues interest, lowered only by refinance
  const annualPay = amortizeAnnual(balance, a.mortgageRate, a.loanTermYears); // amortized at origination; held fixed
  const buyerCash = P0 * (a.downPaymentFraction + a.closingCostRate);
  const deposit = a.securityDepositMonths * metro.monthlyRent; // recoverable, on the initial rent
  let renterAcct = buyerCash - deposit - a.applicationFee; // deposit + fee leave the investable pot
  let buyerAcct = 0;
  let price = P0;
  let rent = 12 * metro.monthlyRent; // year-1 annual rent (no growth yet)

  const years: YearProjection[] = [];
  for (let t = 1; t <= a.horizonYears; t++) {
    const inflation = INFLATION_ANCHOR + (i0 - INFLATION_ANCHOR) * Math.pow(INFLATION_DECAY, t);

    // 1. refinance check (reads start-of-year balance/rate): lower the rate only, charge the cost
    const market = Math.max(0, inflation + premium);
    let refiCost = 0;
    if (balance > 0 && market < rate && rate - market >= a.refiRateDropThreshold) {
      rate = market;
      refiCost = a.refiCostRate * balance;
    }

    // 2. this year's price (updated before carrying costs read it)
    price = price * Math.max(0, 1 + inflation + a.appreciationSpread);

    // 3. outflows (payment capped at amount due; none once the loan is paid off)
    const interest = balance * rate;
    const due = balance + interest;
    const pAndI = balance > 0 ? Math.min(annualPay, due) : 0;
    const carrying = (metro.propertyTaxRate + a.insuranceRate + a.maintenanceRate) * price;
    const buyerOutflow = pAndI + refiCost + carrying;
    const renterOutflow = rent;

    // 4. whoever spends less invests the difference; both accounts grow
    const diff = buyerOutflow - renterOutflow;
    if (diff > 0) renterAcct += diff;
    else buyerAcct += -diff;
    buyerAcct *= 1 + a.investmentReturn;
    renterAcct *= 1 + a.investmentReturn;

    // 5. balance evolves; floors at 0 on payoff (amortized payment ⇒ no negative amortization)
    balance = due - pAndI;

    // 6. record the full year
    const homeEquity = price * (1 - a.sellingCostRate) - balance;
    years.push({
      year: t,
      homePrice: price,
      loanBalance: balance,
      mortgagePaid: pAndI,
      homeEquity,
      buyerInvestments: buyerAcct,
      buyerNetWorth: homeEquity + buyerAcct,
      annualRent: rent,
      renterInvestments: renterAcct,
      renterDeposit: deposit,
      renterNetWorth: renterAcct + deposit,
    });

    // next year's rent grows from this year's inflation
    rent = rent * Math.max(0, 1 + inflation + a.rentGrowthSpread);
  }

  return { years, monthlyPayment: annualPay / 12 };
}
