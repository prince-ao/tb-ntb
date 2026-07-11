// Conformance tests for the metros.json data contract (SCHEMA segment).
// Runner: node:test. Validator: Ajv (draft 2020-12) — the SAME schema the app reuses at runtime.
//
// SCHEMA is a declarative-artifact segment: the schema + fixture already exist (they are the seam),
// so the positive checks pass on first run. Their value is to LOCK the specs (traceability +
// regression) and to prove the schema actually ENFORCES each invariant via negative cases.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
const readJson = (name: string) => JSON.parse(readFileSync(join(here, name), "utf8"));

const schema = readJson("metros.schema.json");
const fixture = readJson("metros.sample.json");

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
/** the fixture with its first metro mutated by `fn` — for negative cases */
const withMetro = (fn: (m: any) => void) => {
  const f = clone(fixture);
  fn(f.metros[0]);
  return f;
};

// @spec SCHEMA-DATA-001
test("the schema compiles as a valid JSON Schema", () => {
  assert.equal(typeof validate, "function");
});

// @spec SCHEMA-DATA-004
test("the sample fixture validates against the schema", () => {
  assert.ok(validate(fixture), ajv.errorsText(validate.errors));
});

// @spec SCHEMA-DATA-003
test("a metro missing a required field is rejected", () => {
  assert.equal(validate(withMetro((m) => delete m.homeValue)), false);
});

// @spec SCHEMA-DATA-002
test("the file carries no assumptions, outputs, or derived values (e.g. priceToRent)", () => {
  // The contract does not define priceToRent...
  assert.ok(!("priceToRent" in schema.$defs.metro.properties));
  // ...and additionalProperties:false rejects a stray derived/assumption field.
  assert.equal(validate(withMetro((m) => (m.priceToRent = 20.3))), false);
});

// @spec SCHEMA-DATA-007
test("every metro must be complete — a null field is rejected", () => {
  assert.equal(validate(withMetro((m) => (m.monthlyRent = null))), false);
});

// @spec SCHEMA-DATA-008
test("an empty metros array is rejected (a zero-metro run is a failed run)", () => {
  const bad = clone(fixture);
  bad.metros = [];
  assert.equal(validate(bad), false);
});

// @spec SCHEMA-DATA-009
test("source provenance (name + asOf) is required for every source", () => {
  const bad = clone(fixture);
  delete bad.sources.rents.asOf;
  assert.equal(validate(bad), false);
});

// @spec SCHEMA-DATA-010
test("per-metro rates are decimals — a percentage-scale propertyTaxRate (> 1) is rejected", () => {
  assert.equal(validate(withMetro((m) => (m.propertyTaxRate = 1.7))), false);
});

// @spec SCHEMA-DATA-010
test("dates must be ISO YYYY-MM-DD", () => {
  const bad = clone(fixture);
  bad.generatedAt = "07/01/2026";
  assert.equal(validate(bad), false);
});

// @spec SCHEMA-DATA-011
test("slug must be URL-safe — uppercase/spaces are rejected", () => {
  assert.equal(validate(withMetro((m) => (m.slug = "Austin TX"))), false);
});

// @spec SCHEMA-DATA-011
test("slugs are unique across metros in the file", () => {
  const slugs = fixture.metros.map((m: any) => m.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

// ---- v2 (shape B): the defaults block ----

const DEFAULT_FIELDS = [
  "downPaymentFraction", "insuranceRate", "maintenanceRate", "closingCostRate",
  "sellingCostRate", "horizonYears", "investmentReturn", "appreciationSpread", "rentGrowthSpread",
  "refiRateDropThreshold", "refiCostRate", "securityDepositMonths", "applicationFee",
  "currentInflation", "mortgageRate",
];

// @spec SCHEMA-DATA-012
test("the file carries a complete defaults block, and validates", () => {
  const d = fixture.defaults;
  assert.ok(d && typeof d === "object", "defaults block missing");
  for (const f of DEFAULT_FIELDS) assert.ok(f in d, `defaults.${f} missing`);
  assert.ok(validate(fixture), ajv.errorsText(validate.errors));
});

// @spec SCHEMA-DATA-012
test("a file missing the defaults block is rejected", () => {
  const bad = clone(fixture);
  delete bad.defaults;
  assert.equal(validate(bad), false);
});

// @spec SCHEMA-DATA-013
test("currentInflation is a scalar (object form rejected); may be negative (deflation)", () => {
  const asObject = clone(fixture);
  if (asObject.defaults) asObject.defaults.currentInflation = { level: 0.02, rateOfChange: 0 };
  assert.equal(validate(asObject), false, "currentInflation as an object should be rejected");

  const deflation = clone(fixture);
  if (deflation.defaults) deflation.defaults.currentInflation = -0.01;
  assert.ok(validate(deflation), "negative currentInflation should be allowed");
});

// @spec SCHEMA-DATA-013
test("mortgageRate is a term-indexed object {30,15}, each >= 0", () => {
  const asScalar = clone(fixture);
  if (asScalar.defaults) asScalar.defaults.mortgageRate = 0.068;
  assert.equal(validate(asScalar), false, "a scalar mortgageRate should be rejected in v5");

  const missingTerm = clone(fixture);
  if (missingTerm.defaults) delete missingTerm.defaults.mortgageRate["15"];
  assert.equal(validate(missingTerm), false, "mortgageRate missing the 15-yr term should be rejected");

  const negRate = clone(fixture);
  if (negRate.defaults) negRate.defaults.mortgageRate["30"] = -0.01;
  assert.equal(validate(negRate), false, "a negative term rate should be rejected");
});

// @spec SCHEMA-DATA-012
test("fixed constants are NOT in the file (decision B) — a smuggled constant is rejected", () => {
  const bad = clone(fixture);
  if (bad.defaults) bad.defaults.inflationAnchor = 0.02;
  assert.equal(validate(bad), false, "additionalProperties:false must reject a stray model constant");
});

// @spec SCHEMA-DATA-015
test("renter upfront costs (securityDepositMonths, applicationFee) are required and >= 0", () => {
  assert.ok(validate(fixture), ajv.errorsText(validate.errors));
  for (const f of ["securityDepositMonths", "applicationFee"]) {
    const missing = clone(fixture);
    if (missing.defaults) delete missing.defaults[f];
    assert.equal(validate(missing), false, `${f} is required`);

    const neg = clone(fixture);
    if (neg.defaults) neg.defaults[f] = -1;
    assert.equal(validate(neg), false, `${f} must be >= 0`);
  }
});

// @spec SCHEMA-DATA-014
test("a defaults fraction outside [0,1] is rejected; a signed spread is allowed", () => {
  const badFrac = clone(fixture);
  if (badFrac.defaults) badFrac.defaults.downPaymentFraction = 1.5;
  assert.equal(validate(badFrac), false);

  const negSpread = clone(fixture);
  if (negSpread.defaults) negSpread.defaults.appreciationSpread = -0.01;
  assert.ok(validate(negSpread), "a negative spread should be allowed");
});

// @spec SCHEMA-DATA-013
test("v2 has no top-level mortgageRate30yr (the rate lives in defaults.mortgageRate.level)", () => {
  assert.ok(!("mortgageRate30yr" in fixture), "mortgageRate30yr should be gone in v2");
  const bad = clone(fixture);
  bad.mortgageRate30yr = 0.068;
  assert.equal(validate(bad), false, "a stray top-level mortgageRate30yr should be rejected");
});
