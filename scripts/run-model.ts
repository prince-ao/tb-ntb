/**
 * Run the financial model against real inputs and print a projection — the quickest way to
 * eyeball what the engine does without opening the app. INFRA dev tooling, not product code:
 * it dogfoods the same public seam (`project` from @tb-ntb/model) the app builds against.
 *
 *   npm run model                    a sample of metros from the data file, 30-year term
 *   npm run model -- austin-tx       one metro by slug
 *   npm run model -- --term 15       15-year term
 *   npm run model -- --all           every metro in the file (can be hundreds)
 *   npm run model -- austin-tx cleveland-oh --term 15
 *
 * Data source: repo-root metros.json if the pipeline has emitted one, else the committed
 * contract/metros.sample.json fixture. The defaults→Assumptions mapping mirrors the app's
 * bridge in packages/app/src/lib/contract.ts (kept small and deliberately duplicated so this
 * script stays decoupled from app internals).
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { project, type Assumptions, type Metro } from "@tb-ntb/model";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface ContractMetro {
  slug: string;
  regionId: string;
  name: string;
  state: string;
  homeValue: number;
  monthlyRent: number;
  propertyTaxRate: number;
}
interface ContractDefaults {
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
  mortgageRate: { "30": number; "15": number };
}
interface MetrosFile {
  schemaVersion: string;
  generatedAt: string;
  defaults: ContractDefaults;
  metros: ContractMetro[];
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

const SAMPLE_CAP = 6; // metros to show when none named and --all is absent

function parseArgs(argv: string[]): { slugs: string[]; term: 15 | 30; all: boolean } {
  const slugs: string[] = [];
  let term = 30;
  let all = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--term") term = Number(argv[++i]);
    else if (a.startsWith("--term=")) term = Number(a.slice("--term=".length));
    else if (a === "--all") all = true;
    else if (a.startsWith("-")) fail(`unknown flag: ${a}`);
    else slugs.push(a);
  }
  if (term !== 15 && term !== 30) fail(`--term must be 15 or 30 (got ${term})`);
  return { slugs, term: term as 15 | 30, all };
}

function fail(msg: string): never {
  console.error(`run-model: ${msg}`);
  process.exit(1);
}

function toMetro(m: ContractMetro): Metro {
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

function toAssumptions(d: ContractDefaults, term: 15 | 30): Assumptions {
  return {
    downPaymentFraction: d.downPaymentFraction,
    loanTermYears: term,
    insuranceRate: d.insuranceRate,
    maintenanceRate: d.maintenanceRate,
    closingCostRate: d.closingCostRate,
    sellingCostRate: d.sellingCostRate,
    horizonYears: d.horizonYears,
    investmentReturn: d.investmentReturn,
    mortgageRate: d.mortgageRate[String(term) as "15" | "30"], // market input — not dialed
    currentInflation: d.currentInflation, // market input — not dialed
    appreciationSpread: d.appreciationSpread,
    rentGrowthSpread: d.rentGrowthSpread,
    refiRateDropThreshold: d.refiRateDropThreshold,
    refiCostRate: d.refiCostRate,
    securityDepositMonths: d.securityDepositMonths,
    applicationFee: d.applicationFee,
  };
}

function report(m: ContractMetro, d: ContractDefaults, term: 15 | 30): void {
  const a = toAssumptions(d, term);
  const proj = project(toMetro(m), a);

  console.log(`\n\x1b[1m${m.name}\x1b[0m  (${m.slug})`);
  console.log(
    `  home ${usd.format(m.homeValue)} · rent ${usd.format(m.monthlyRent)}/mo · ` +
      `${term}-yr @ ${pct(a.mortgageRate)} · down ${pct(a.downPaymentFraction)} · ` +
      `return ${pct(a.investmentReturn)} · P&I ${usd.format(proj.monthlyPayment)}/mo`,
  );

  const col = (s: string, w: number) => s.padStart(w);
  console.log(
    `  ${col("Yr", 3)}  ${col("Home", 12)}  ${col("Buyer NW", 13)}  ${col("Renter NW", 13)}  ${col("Δ buy−rent", 13)}  Ahead`,
  );
  for (const y of proj.years) {
    const delta = y.buyerNetWorth - y.renterNetWorth;
    const ahead = delta >= 0 ? "\x1b[32mbuy\x1b[0m" : "\x1b[33mrent\x1b[0m";
    const deltaStr = (delta >= 0 ? "+" : "−") + usd.format(Math.abs(delta));
    console.log(
      `  ${col(String(y.year), 3)}  ${col(usd.format(y.homePrice), 12)}  ` +
        `${col(usd.format(y.buyerNetWorth), 13)}  ${col(usd.format(y.renterNetWorth), 13)}  ` +
        `${col(deltaStr, 13)}  ${ahead}`,
    );
  }

  const be = proj.years.find((y) => y.buyerNetWorth >= y.renterNetWorth);
  console.log(
    be
      ? `  → Buying pulls ahead in year ${be.year}.`
      : `  → Renting stays ahead through year ${proj.years.length}.`,
  );
}

function main(): void {
  const { slugs, term, all } = parseArgs(process.argv.slice(2));

  const emitted = resolve(ROOT, "metros.json");
  const fixture = resolve(ROOT, "contract/metros.sample.json");
  const dataPath = existsSync(emitted) ? emitted : fixture;
  const file = JSON.parse(readFileSync(dataPath, "utf8")) as MetrosFile;

  console.log(
    `Data: ${dataPath === emitted ? "metros.json (pipeline output)" : "contract/metros.sample.json (fixture)"} ` +
      `· schema ${file.schemaVersion} · generated ${file.generatedAt} · horizon ${file.defaults.horizonYears}y ` +
      `· ${file.metros.length} metros`,
  );

  let metros = file.metros;
  if (slugs.length) {
    metros = metros.filter((m) => slugs.includes(m.slug));
    const missing = slugs.filter((s) => !file.metros.some((m) => m.slug === s));
    if (missing.length)
      fail(`no metro for slug(s): ${missing.join(", ")}. Available: ${file.metros.map((m) => m.slug).join(", ")}`);
  } else if (!all && metros.length > SAMPLE_CAP) {
    const shown = metros.slice(0, SAMPLE_CAP);
    console.log(
      `Showing the first ${SAMPLE_CAP} of ${metros.length}. Pass a slug (e.g. \`npm run model -- ${metros[0].slug}\`) ` +
        `or \`--all\` for every metro.`,
    );
    metros = shown;
  }

  for (const m of metros) report(m, file.defaults, term);
}

main();
