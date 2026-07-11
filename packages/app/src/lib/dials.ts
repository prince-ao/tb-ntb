import type { Dials } from "./contract";

/** A dial's slider works in display units; model value = display × scale. */
export interface DialSpec {
  key: Exclude<keyof Dials, "loanTermYears">;
  label: string;
  sub?: string;
  min: number;
  max: number;
  step: number;
  advanced: boolean;
  scale: number;
  fmt: (display: number) => string;
}

export const DIAL_SPECS: DialSpec[] = [
  { key: "downPaymentFraction", label: "Down payment", min: 0, max: 50, step: 1, advanced: false, scale: 0.01, fmt: (v) => `${v}%` },
  { key: "investmentReturn", label: "Investment return", min: 0, max: 12, step: 0.5, advanced: false, scale: 0.01, fmt: (v) => `${v.toFixed(1)}%` },
  { key: "appreciationSpread", label: "Appreciation", sub: "vs. inflation", min: -3, max: 5, step: 0.5, advanced: false, scale: 0.01, fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}` },
  { key: "rentGrowthSpread", label: "Rent growth", sub: "vs. inflation", min: -3, max: 5, step: 0.5, advanced: true, scale: 0.01, fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}` },
  { key: "maintenanceRate", label: "Maintenance", min: 0, max: 3, step: 0.1, advanced: true, scale: 0.01, fmt: (v) => `${v.toFixed(1)}%` },
  { key: "insuranceRate", label: "Insurance", min: 0, max: 2, step: 0.1, advanced: true, scale: 0.01, fmt: (v) => `${v.toFixed(1)}%` },
  { key: "closingCostRate", label: "Closing costs", min: 0, max: 6, step: 0.5, advanced: true, scale: 0.01, fmt: (v) => `${v.toFixed(1)}%` },
  { key: "sellingCostRate", label: "Selling costs", min: 0, max: 10, step: 0.5, advanced: true, scale: 0.01, fmt: (v) => `${v.toFixed(1)}%` },
  { key: "securityDepositMonths", label: "Security deposit", min: 0, max: 3, step: 0.5, advanced: true, scale: 1, fmt: (v) => `${v} mo` },
  { key: "applicationFee", label: "Application fee", min: 0, max: 200, step: 10, advanced: true, scale: 1, fmt: (v) => `$${v}` },
  { key: "refiRateDropThreshold", label: "Refi trigger drop", min: 0.25, max: 3, step: 0.25, advanced: true, scale: 0.01, fmt: (v) => v.toFixed(2) },
  { key: "refiCostRate", label: "Refi cost", min: 0, max: 5, step: 0.5, advanced: true, scale: 0.01, fmt: (v) => `${v.toFixed(1)}%` },
];
