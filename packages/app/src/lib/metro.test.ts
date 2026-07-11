import { describe, it, expect } from "vitest";
import { matchMetro, filterMetros, defaultSlug, slugFromHash } from "./metro";
import type { ContractMetro } from "./contract";

const m = (slug: string, name: string, state: string): ContractMetro => ({
  slug, name, state, regionId: "0", homeValue: 1, monthlyRent: 1, propertyTaxRate: 0,
});
const AUSTIN_TX = m("austin-tx", "Austin, TX", "TX");
const AUSTIN_MN = m("austin-mn", "Austin, MN", "MN");
const DALLAS_TX = m("dallas-tx", "Dallas, TX", "TX");
const BOISE_ID = m("boise-city-id", "Boise City, ID", "ID");
const SET = [AUSTIN_TX, AUSTIN_MN, DALLAS_TX, BOISE_ID];

describe("matchMetro", () => {
  // @spec APP-UI-008
  it("matches by name, case-insensitively", () => {
    expect(matchMetro(AUSTIN_TX, "austin")).toBe(true);
    expect(matchMetro(AUSTIN_TX, "AUS")).toBe(true);
    expect(matchMetro(AUSTIN_TX, "dallas")).toBe(false);
  });
  // @spec APP-UI-008
  it("matches by two-letter state code", () => {
    expect(matchMetro(AUSTIN_TX, "tx")).toBe(true);
    expect(matchMetro(BOISE_ID, "tx")).toBe(false);
  });
  it("empty or whitespace query matches everything", () => {
    expect(matchMetro(BOISE_ID, "")).toBe(true);
    expect(matchMetro(BOISE_ID, "   ")).toBe(true);
  });
});

describe("filterMetros", () => {
  // @spec APP-UI-008
  it("'tx' narrows to Texas metros", () => {
    const { shown } = filterMetros(SET, "tx");
    expect(shown.map((x) => x.slug).sort()).toEqual(["austin-tx", "dallas-tx"]);
  });
  it("'austin' surfaces both Austins", () => {
    expect(filterMetros(SET, "austin").total).toBe(2);
  });
  // @spec APP-UI-009
  it("caps the shown list and flags that more matched", () => {
    const many = Array.from({ length: 30 }, (_, i) => m(`m-${i}`, `Metro ${i}, TX`, "TX"));
    const r = filterMetros(many, "", 20);
    expect(r.shown).toHaveLength(20);
    expect(r.total).toBe(30);
    expect(r.capped).toBe(true);
  });
  it("does not flag capped when everything fits", () => {
    expect(filterMetros(SET, "", 20).capped).toBe(false);
  });
});

describe("defaultSlug", () => {
  // @spec APP-UI-012
  it("prefers the preferred slug when present", () => {
    expect(defaultSlug(SET, "dallas-tx")).toBe("dallas-tx");
  });
  // @spec APP-UI-012
  it("falls back to the first metro when the preferred is absent", () => {
    expect(defaultSlug(SET, "nowhere-zz")).toBe("austin-tx");
  });
});

describe("slugFromHash", () => {
  // @spec APP-UI-013
  it("returns the slug when the hash names a metro", () => {
    expect(slugFromHash("#dallas-tx", SET)).toBe("dallas-tx");
    expect(slugFromHash("#/dallas-tx", SET)).toBe("dallas-tx");
  });
  // @spec APP-UI-013
  it("returns null for an unknown, empty, or bare hash", () => {
    expect(slugFromHash("#nowhere-zz", SET)).toBeNull();
    expect(slugFromHash("", SET)).toBeNull();
    expect(slugFromHash("#", SET)).toBeNull();
  });
});
