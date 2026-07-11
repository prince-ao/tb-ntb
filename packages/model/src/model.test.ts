import { describe, it, expect } from "vitest";
import { project, type Metro, type Assumptions } from "./index";

// --- fixtures -------------------------------------------------------------

const METRO: Metro = {
  regionId: "TEST",
  name: "Testville, TX",
  state: "TX",
  homeValue: 400_000,
  monthlyRent: 2_000,
  propertyTaxRate: 0.017,
  priceToRent: 16.67,
};

/** A realistic, in-domain assumptions set. The payment is amortized from the loan, m0, and term. */
const BASE: Assumptions = {
  downPaymentFraction: 0.2,
  loanTermYears: 30, // amortization term (the app's 30/15 toggle)
  insuranceRate: 0.005,
  maintenanceRate: 0.01,
  closingCostRate: 0.03,
  sellingCostRate: 0.06,
  horizonYears: 10,
  investmentReturn: 0.06,
  mortgageRate: 0.068,
  currentInflation: 0.02,
  appreciationSpread: 0.01,
  rentGrowthSpread: 0.01,
  refiRateDropThreshold: 0.01,
  refiCostRate: 0.02,
  securityDepositMonths: 1,
  applicationFee: 50,
};

const metro = (o: Partial<Metro> = {}): Metro => ({ ...METRO, ...o });
const asmp = (o: Partial<Assumptions> = {}): Assumptions => ({ ...BASE, ...o });

/**
 * A zeroed-out world for exact hand-checkable arithmetic. Inflation pinned at the 2% anchor,
 * spreads cancel it (appreciation & rent growth = 0), mortgage rate 0. Home 100k, 20% down ->
 * loan 80k; a rate-0 10-year term amortizes to annualPay = 80k/10 = 8000 (monthlyPayment ~ 666.67).
 * Buyer P&I 8000 < rent 12000, so the buyer invests the 4000 surplus each year (return 0).
 */
const CLEAN = asmp({
  downPaymentFraction: 0.2,
  loanTermYears: 10,
  insuranceRate: 0,
  maintenanceRate: 0,
  closingCostRate: 0,
  sellingCostRate: 0,
  investmentReturn: 0,
  currentInflation: 0.02,
  mortgageRate: 0,
  appreciationSpread: -0.02,
  rentGrowthSpread: -0.02,
  refiRateDropThreshold: 1,
  refiCostRate: 0,
  securityDepositMonths: 0,
  applicationFee: 0,
  horizonYears: 2,
});
const CLEAN_METRO = metro({ homeValue: 100_000, monthlyRent: 1_000, propertyTaxRate: 0 });

// =========================================================================
// Shape, purity, horizon-independence (MODEL-PROC)
// =========================================================================

describe("project — shape & purity", () => {
  // @spec MODEL-PROC-001
  it("returns exactly horizonYears results, 1-based", () => {
    const p = project(metro(), asmp({ horizonYears: 10 }));
    expect(p.years).toHaveLength(10);
    expect(p.years[0].year).toBe(1);
    expect(p.years[9].year).toBe(10);
  });

  // @spec MODEL-PROC-015
  it("reports the full per-year picture", () => {
    const y = project(metro(), asmp()).years[0];
    expect(Object.keys(y).sort()).toEqual(
      [
        "annualRent",
        "buyerInvestments",
        "buyerNetWorth",
        "homeEquity",
        "homePrice",
        "loanBalance",
        "mortgagePaid",
        "renterDeposit",
        "renterInvestments",
        "renterNetWorth",
        "year",
      ].sort(),
    );
  });

  // @spec MODEL-PROC-017
  it("reports the amortized monthly payment on the projection", () => {
    // rate 0, loan 80k, term 10 -> annualPay 8000 -> monthly 666.67.
    const p = project(CLEAN_METRO, CLEAN);
    expect(p.monthlyPayment).toBeCloseTo(8_000 / 12, 6);
  });

  // @spec MODEL-PROC-008, MODEL-PROC-009
  it("net worths are the documented sums of their components", () => {
    const y = project(metro(), asmp()).years[3];
    expect(y.buyerNetWorth).toBeCloseTo(y.homeEquity + y.buyerInvestments, 6);
    expect(y.renterNetWorth).toBeCloseTo(y.renterInvestments + y.renterDeposit, 6);
  });

  // @spec MODEL-PROC-006
  it("is deterministic", () => {
    expect(project(metro(), asmp())).toEqual(project(metro(), asmp()));
  });

  // @spec MODEL-PROC-014
  it("computes each year independently of the horizon", () => {
    const p10 = project(metro(), asmp({ horizonYears: 10 }));
    const p6 = project(metro(), asmp({ horizonYears: 6 }));
    expect(p6.years[4]).toEqual(p10.years[4]); // year 5 identical
  });
});

// =========================================================================
// Net-worth recurrence & loan balance — exact anchors (MODEL-PROC / MODEL-LOAN)
// =========================================================================

describe("project — exact anchors (CLEAN world)", () => {
  // @spec MODEL-PROC-015, MODEL-PROC-008, MODEL-LOAN-003, MODEL-LOAN-007
  it("emits the correct components for a hand-computable year", () => {
    // loan 80k, rate 0, term 10 -> annualPay 8000. balance 80k -> 72k; equity 28k.
    // buyer P&I 8000 < rent 12000 -> invests 4000 (return 0). renter buyerCash 20k, invests nothing.
    const y = project(CLEAN_METRO, CLEAN).years[0];
    expect(y.homePrice).toBeCloseTo(100_000, 3);
    expect(y.mortgagePaid).toBeCloseTo(8_000, 3); // = amortized annualPay
    expect(y.loanBalance).toBeCloseTo(72_000, 3);
    expect(y.homeEquity).toBeCloseTo(28_000, 3);
    expect(y.buyerInvestments).toBeCloseTo(4_000, 3);
    expect(y.buyerNetWorth).toBeCloseTo(32_000, 3);
    expect(y.annualRent).toBeCloseTo(12_000, 3);
    expect(y.renterInvestments).toBeCloseTo(20_000, 3);
    expect(y.renterNetWorth).toBeCloseTo(20_000, 3);
  });

  // @spec MODEL-LOAN-007
  it("draws the balance down by the amortized payment each year (rate 0)", () => {
    const p = project(CLEAN_METRO, CLEAN);
    expect(p.years[0].loanBalance).toBeCloseTo(72_000, 3);
    expect(p.years[1].loanBalance).toBeCloseTo(64_000, 3);
    expect(p.years[1].buyerNetWorth).toBeCloseTo(44_000, 3);
  });

  // @spec MODEL-PROC-011
  it("compounds side accounts at investmentReturn", () => {
    // Buyer P&I 8000 < rent 12000 -> invests 4000/yr at 10%.
    const p = project(CLEAN_METRO, asmp({ ...CLEAN, investmentReturn: 0.1, horizonYears: 2 }));
    // Y1 buyer invests 4k -> 4400; Y2 +4k -> 8400 -> 9240. balance 80k->72k->64k; equity 36k.
    expect(p.years[1].buyerInvestments).toBeCloseTo(9_240, 2);
    expect(p.years[1].buyerNetWorth).toBeCloseTo(45_240, 2);
  });
});

// =========================================================================
// Renter upfront costs (MODEL-PROC-009/010/016)
// =========================================================================

describe("project — renter upfront (deposit + fee)", () => {
  // @spec MODEL-PROC-010, MODEL-PROC-009, MODEL-PROC-016
  it("deposit is recoverable (nets out), application fee is sunk", () => {
    // buyerCash 20k; deposit 1mo = 1000; fee 50 -> renterAcct0 = 18950. Buyer P&I 8000 < rent 12000,
    // so the buyer invests the surplus and the renter invests nothing -> renterInvestments stays 18950.
    // renterNetWorth = 18950 + 1000 = 19950 (= 20000 buyerCash - 50 fee).
    const p = project(
      metro({ homeValue: 100_000, monthlyRent: 1_000, propertyTaxRate: 0 }),
      asmp({
        downPaymentFraction: 0.2,
        closingCostRate: 0,
        loanTermYears: 10,
        mortgageRate: 0,
        insuranceRate: 0,
        maintenanceRate: 0,
        sellingCostRate: 0,
        investmentReturn: 0,
        currentInflation: 0.02,
        appreciationSpread: -0.02,
        rentGrowthSpread: -0.02,
        refiRateDropThreshold: 1,
        securityDepositMonths: 1,
        applicationFee: 50,
        horizonYears: 1,
      }),
    );
    expect(p.years[0].renterInvestments).toBeCloseTo(18_950, 3);
    expect(p.years[0].renterDeposit).toBeCloseTo(1_000, 3);
    expect(p.years[0].renterNetWorth).toBeCloseTo(19_950, 3);
  });
});

// =========================================================================
// Rate trajectories (MODEL-RATE)
// =========================================================================

const ALL_CASH = asmp({
  downPaymentFraction: 1, // all cash -> loan 0 -> amortized payment 0, whatever the term
  closingCostRate: 0,
  loanTermYears: 30,
  insuranceRate: 0,
  maintenanceRate: 0,
  sellingCostRate: 0,
  investmentReturn: 0,
  currentInflation: 0.02,
  appreciationSpread: 0.03, // appreciation = 0.05 / yr
  rentGrowthSpread: -0.02, // rent growth = 0
  refiRateDropThreshold: 1,
  securityDepositMonths: 0,
  applicationFee: 0,
  horizonYears: 2,
});
const ONE_DOLLAR_RENT = metro({ homeValue: 100_000, monthlyRent: 1, propertyTaxRate: 0 });

describe("project — rate trajectories", () => {
  // @spec MODEL-RATE-005, MODEL-RATE-003
  it("appreciates price from P0 at inflation+spread, compounding", () => {
    const p = project(ONE_DOLLAR_RENT, ALL_CASH);
    expect(p.years[0].buyerNetWorth).toBeCloseTo(105_012, 3); // price 105000 + 12 invested
    expect(p.years[1].buyerNetWorth).toBeCloseTo(110_274, 3); // price 110250 + 24
  });

  // @spec MODEL-RATE-001
  it("inflation mean-reverts toward the 2% anchor (high i0 -> decelerating appreciation)", () => {
    // carrying > rent so buyer invests nothing -> buyerNetWorth == home price exactly.
    const p = project(
      metro({ homeValue: 100_000, monthlyRent: 1, propertyTaxRate: 0.01 }),
      asmp({ ...ALL_CASH, currentInflation: 0.1, appreciationSpread: 0, rentGrowthSpread: 0, horizonYears: 3 }),
    );
    const g1 = p.years[0].buyerNetWorth / 100_000 - 1;
    const g2 = p.years[1].buyerNetWorth / p.years[0].buyerNetWorth - 1;
    const g3 = p.years[2].buyerNetWorth / p.years[1].buyerNetWorth - 1;
    expect(g1).toBeLessThan(0.1);
    expect(g2).toBeLessThan(g1);
    expect(g3).toBeLessThan(g2);
    expect(g3).toBeGreaterThan(0.02);
  });

  // @spec MODEL-RATE-004
  it("allows negative appreciation but floors price at 0", () => {
    const p = project(
      ONE_DOLLAR_RENT,
      asmp({ ...ALL_CASH, currentInflation: -1.5, appreciationSpread: 0, horizonYears: 1 }),
    );
    expect(Number.isFinite(p.years[0].buyerNetWorth)).toBe(true);
    expect(p.years[0].buyerNetWorth).toBeCloseTo(12, 3); // price floored to 0; buyer invested rent 12
  });

  // @spec MODEL-RATE-002
  it("floors the derived mortgage market rate at 0 (deep-negative premium stays finite)", () => {
    const p = project(metro(), asmp({ mortgageRate: 0.02, currentInflation: 0.3, refiRateDropThreshold: 0.01 }));
    expect(p.years.every((y) => Number.isFinite(y.buyerNetWorth) && Number.isFinite(y.renterNetWorth))).toBe(true);
  });

  // @spec MODEL-RATE-006
  it("derives the mortgage market path from inflation + a frozen premium (m0 shifts it)", () => {
    const lowM0 = project(metro(), asmp({ currentInflation: 0.05, mortgageRate: 0.06, refiRateDropThreshold: 0.01 }));
    const highM0 = project(metro(), asmp({ currentInflation: 0.05, mortgageRate: 0.09, refiRateDropThreshold: 0.01 }));
    expect(lowM0.years).not.toEqual(highM0.years);
  });
});

// =========================================================================
// Loan mechanics (MODEL-LOAN)
// =========================================================================

const LOAN_METRO = metro({ homeValue: 100_000, monthlyRent: 1_000, propertyTaxRate: 0 });
const LOAN_BASE = asmp({
  downPaymentFraction: 0.2,
  closingCostRate: 0,
  insuranceRate: 0,
  maintenanceRate: 0,
  sellingCostRate: 0,
  investmentReturn: 0,
  currentInflation: 0.02,
  appreciationSpread: -0.02,
  rentGrowthSpread: -0.02,
  refiRateDropThreshold: 1,
  securityDepositMonths: 0,
  applicationFee: 0,
});

describe("project — loan mechanics", () => {
  // @spec MODEL-LOAN-003, MODEL-PROC-017
  it("amortizes the payment from loan, rate, and term; holds it fixed (rate 0)", () => {
    // loan 80k, rate 0, term 10 -> annualPay 8000 = mortgagePaid each year; monthly 666.67.
    const p = project(LOAN_METRO, asmp({ ...LOAN_BASE, loanTermYears: 10, mortgageRate: 0, horizonYears: 3 }));
    expect(p.monthlyPayment).toBeCloseTo(8_000 / 12, 6);
    expect(p.years[0].mortgagePaid).toBeCloseTo(8_000, 3);
    expect(p.years[1].mortgagePaid).toBeCloseTo(8_000, 3);
    expect(p.years[2].mortgagePaid).toBeCloseTo(8_000, 3);
  });

  // @spec MODEL-LOAN-003
  it("amortizes a positive-rate loan so it retires the balance to ~0 at the end of the term", () => {
    // 15-year loan at 5% carried its full term -> balance ~ 0 at year 15, and the payment
    // always exceeds the first year's interest (so the balance only ever falls — no neg-am).
    const p = project(LOAN_METRO, asmp({ ...LOAN_BASE, loanTermYears: 15, mortgageRate: 0.05, horizonYears: 15 }));
    expect(Math.abs(p.years[14].loanBalance)).toBeLessThan(0.01);
    expect(p.years[0].mortgagePaid).toBeGreaterThan(80_000 * 0.05); // > first-year interest
    expect(p.years[0].loanBalance).toBeLessThan(80_000);
  });

  // @spec MODEL-LOAN-007, MODEL-LOAN-006
  it("pays the loan off at the end of the term, then charges nothing (rate 0, term 1)", () => {
    // loan 80k, rate 0, term 1 -> annualPay 80k -> pays off in year 1, then 0.
    const p = project(LOAN_METRO, asmp({ ...LOAN_BASE, loanTermYears: 1, mortgageRate: 0, horizonYears: 2 }));
    expect(p.years[0].mortgagePaid).toBeCloseTo(80_000, 3);
    expect(p.years[0].loanBalance).toBeCloseTo(0, 3);
    expect(p.years[1].mortgagePaid).toBeCloseTo(0, 3); // paid off
    expect(p.years[1].loanBalance).toBeCloseTo(0, 3);
  });

  // @spec MODEL-LOAN-004, MODEL-LOAN-005
  it("refinancing (rate falls past threshold) changes the trajectory", () => {
    const refiOn = project(metro(), asmp({ mortgageRate: 0.1, currentInflation: 0.1, refiRateDropThreshold: 0.01 }));
    const refiOff = project(metro(), asmp({ mortgageRate: 0.1, currentInflation: 0.1, refiRateDropThreshold: 0.99 }));
    expect(refiOn.years).not.toEqual(refiOff.years);
  });
});

// =========================================================================
// Carrying costs & outflow composition (MODEL-PROC-012/013)
// =========================================================================

describe("project — carrying costs & outflow", () => {
  // @spec MODEL-PROC-012, MODEL-PROC-013
  it("charges tax/insurance/maintenance on the end-of-year price; outflow drives the surplus", () => {
    // All-cash (no P&I), carrying 0.02 on the appreciated price 110000 = 2200 (NOT 0.02*100000).
    // buyer outflow 2200 > rent 12 -> renter invests 2188 -> renterNetWorth 102188.
    const p = project(
      metro({ homeValue: 100_000, monthlyRent: 1, propertyTaxRate: 0.01 }),
      asmp({
        downPaymentFraction: 1,
        closingCostRate: 0,
        loanTermYears: 30,
        insuranceRate: 0.005,
        maintenanceRate: 0.005,
        sellingCostRate: 0,
        investmentReturn: 0,
        currentInflation: 0.02,
        appreciationSpread: 0.08,
        rentGrowthSpread: 0,
        refiRateDropThreshold: 1,
        securityDepositMonths: 0,
        applicationFee: 0,
        horizonYears: 1,
      }),
    );
    expect(p.years[0].renterNetWorth).toBeCloseTo(102_188, 3);
    expect(p.years[0].buyerNetWorth).toBeCloseTo(110_000, 3);
  });
});

// =========================================================================
// Input validation (MODEL-VAL)
// =========================================================================

describe("project — validation", () => {
  it("accepts an in-domain assumptions set", () => {
    expect(() => project(metro(), asmp())).not.toThrow();
  });

  // @spec MODEL-VAL-001
  it.each<[string, Metro, Assumptions]>([
    ["loanTermYears = 0", metro(), asmp({ loanTermYears: 0 })],
    ["loanTermYears non-integer", metro(), asmp({ loanTermYears: 15.5 })],
    ["securityDepositMonths < 0", metro(), asmp({ securityDepositMonths: -1 })],
    ["applicationFee < 0", metro(), asmp({ applicationFee: -1 })],
    ["horizonYears = 0", metro(), asmp({ horizonYears: 0 })],
    ["horizonYears non-integer", metro(), asmp({ horizonYears: 3.5 })],
    ["downPaymentFraction > 1", metro(), asmp({ downPaymentFraction: 1.5 })],
    ["downPaymentFraction < 0", metro(), asmp({ downPaymentFraction: -0.1 })],
    ["investmentReturn = -1", metro(), asmp({ investmentReturn: -1 })],
    ["refiRateDropThreshold = 0", metro(), asmp({ refiRateDropThreshold: 0 })],
    ["mortgageRate < 0", metro(), asmp({ mortgageRate: -0.01 })],
    ["homeValue = 0", metro({ homeValue: 0 }), asmp()],
    ["monthlyRent = 0", metro({ monthlyRent: 0 }), asmp()],
  ])("throws RangeError on out-of-domain input: %s", (_label, m, a) => {
    expect(() => project(m, a)).toThrow(RangeError);
  });
});
