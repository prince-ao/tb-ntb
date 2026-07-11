import { project, type Metro, type Assumptions, type Projection } from "@tb-ntb/model";

// ---- the data contract (metros.json, schema v4) ----
export interface ContractMetro {
  slug: string;
  regionId: string;
  name: string;
  state: string;
  homeValue: number;
  monthlyRent: number;
  propertyTaxRate: number;
}
export interface ContractDefaults {
  downPaymentFraction: number;
  insuranceRate: number;
  maintenanceRate: number;
  closingCostRate: number;
  sellingCostRate: number;
  horizonYears: number;
  investmentReturn: number;
  appreciationSpread: number;
  rentGrowthSpread: number;
  refiRateDropThreshold: number;
  refiCostRate: number;
  securityDepositMonths: number;
  applicationFee: number;
  currentInflation: number;
  // v5: term-indexed origination rates; the app picks one via the loan-term toggle
  mortgageRate: { "30": number; "15": number };
}
export interface Source {
  name: string;
  asOf: string;
}
export interface MetrosFile {
  schemaVersion: string;
  generatedAt: string;
  sources: { homeValues: Source; rents: Source; mortgageRate: Source; propertyTax: Source };
  defaults: ContractDefaults;
  metros: ContractMetro[];
}

// ---- user-adjustable inputs (dial state); loanTermYears drives the derived monthly payment ----
export interface Dials {
  downPaymentFraction: number;
  investmentReturn: number;
  appreciationSpread: number;
  rentGrowthSpread: number;
  maintenanceRate: number;
  insuranceRate: number;
  closingCostRate: number;
  sellingCostRate: number;
  securityDepositMonths: number;
  applicationFee: number;
  refiRateDropThreshold: number;
  refiCostRate: number;
  loanTermYears: number;
}

export function dialsFromDefaults(d: ContractDefaults): Dials {
  return {
    downPaymentFraction: d.downPaymentFraction,
    investmentReturn: d.investmentReturn,
    appreciationSpread: d.appreciationSpread,
    rentGrowthSpread: d.rentGrowthSpread,
    maintenanceRate: d.maintenanceRate,
    insuranceRate: d.insuranceRate,
    closingCostRate: d.closingCostRate,
    sellingCostRate: d.sellingCostRate,
    securityDepositMonths: d.securityDepositMonths,
    applicationFee: d.applicationFee,
    refiRateDropThreshold: d.refiRateDropThreshold,
    refiCostRate: d.refiCostRate,
    loanTermYears: 30, // app-side default; selects which term-rate the contract provides
  };
}

export function toMetro(m: ContractMetro): Metro {
  return {
    regionId: m.regionId,
    name: m.name,
    state: m.state,
    homeValue: m.homeValue,
    monthlyRent: m.monthlyRent,
    propertyTaxRate: m.propertyTaxRate,
    priceToRent: m.homeValue / (12 * m.monthlyRent),
  };
}

/**
 * BRIDGE adapter (schema v5). The contract publishes term-indexed origination rates
 * (`mortgageRate.{30,15}`); the model wants a scalar rate + the loan term. So the app picks the
 * rate for the loan-term toggle and passes it plus the term — the model amortizes the payment
 * itself (and reports it on the projection). Field names (`applicationFee`, `currentInflation`)
 * match the model directly.
 */
export function toAssumptions(d: ContractDefaults, dials: Dials): Assumptions {
  const term: "30" | "15" = dials.loanTermYears === 15 ? "15" : "30";
  const rate = d.mortgageRate[term]; // today's origination rate for the chosen term
  return {
    downPaymentFraction: dials.downPaymentFraction,
    loanTermYears: dials.loanTermYears,
    insuranceRate: dials.insuranceRate,
    maintenanceRate: dials.maintenanceRate,
    closingCostRate: dials.closingCostRate,
    sellingCostRate: dials.sellingCostRate,
    horizonYears: d.horizonYears,
    investmentReturn: dials.investmentReturn,
    mortgageRate: rate, // market input — not dialed
    currentInflation: d.currentInflation, // market input — not dialed
    appreciationSpread: dials.appreciationSpread,
    rentGrowthSpread: dials.rentGrowthSpread,
    refiRateDropThreshold: dials.refiRateDropThreshold,
    refiCostRate: dials.refiCostRate,
    securityDepositMonths: dials.securityDepositMonths,
    applicationFee: dials.applicationFee,
  };
}

export function runModel(m: ContractMetro, d: ContractDefaults, dials: Dials): Projection {
  return project(toMetro(m), toAssumptions(d, dials));
}

/** First year the buyer's net worth reaches the renter's, or null if it never does. */
export function breakevenYear(proj: Projection): number | null {
  for (const y of proj.years) if (y.buyerNetWorth >= y.renterNetWorth) return y.year;
  return null;
}

// ---- itemized picture at one exit year (the comparison table) ----
export interface Itemized {
  home: number;
  downPayment: number;
  closingCost: number;
  monthlyPayment: number;
  equity: number;
  interestPaid: number;
  upfront: number;
  deposit: number;
  appFee: number;
  monthlyRent: number;
  investments: number;
  rentPaid: number;
  netHannah: number;
  netRyan: number;
}
export function itemize(
  proj: Projection,
  m: ContractMetro,
  dials: Dials,
  year: number,
): Itemized {
  const initialLoan = m.homeValue * (1 - dials.downPaymentFraction);
  let paid = 0;
  let rent = 0;
  for (let i = 0; i < year; i++) {
    paid += proj.years[i].mortgagePaid;
    rent += proj.years[i].annualRent;
  }
  const y = proj.years[year - 1];
  const deposit = dials.securityDepositMonths * m.monthlyRent;
  return {
    home: y.homePrice,
    downPayment: m.homeValue * dials.downPaymentFraction,
    closingCost: m.homeValue * dials.closingCostRate,
    monthlyPayment: proj.monthlyPayment,
    equity: y.homeEquity,
    // total P&I paid minus principal actually retired = interest paid to date
    interestPaid: paid - (initialLoan - y.loanBalance),
    upfront: deposit + dials.applicationFee,
    deposit,
    appFee: dials.applicationFee,
    monthlyRent: y.annualRent / 12,
    investments: y.renterInvestments,
    rentPaid: rent,
    netHannah: y.buyerNetWorth,
    netRyan: y.renterNetWorth,
  };
}
