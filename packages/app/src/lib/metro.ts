import type { ContractMetro } from "./contract";

/** Case-insensitive substring match on the metro's name or its two-letter state code. */
// @spec APP-UI-008
export function matchMetro(m: ContractMetro, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return m.name.toLowerCase().includes(needle) || m.state.toLowerCase().includes(needle);
}

export interface MetroFilter {
  shown: ContractMetro[];
  total: number;
  capped: boolean;
}

/** Filter by query, then cap the visible list (default 20). `capped` marks that more matched than shown. */
// @spec APP-UI-008, APP-UI-009
export function filterMetros(metros: ContractMetro[], query: string, cap = 20): MetroFilter {
  const matches = metros.filter((m) => matchMetro(m, query));
  return { shown: matches.slice(0, cap), total: matches.length, capped: matches.length > cap };
}

/** The default metro on load: a stable preferred slug when present, else the first metro in the file. */
// @spec APP-UI-012
export function defaultSlug(metros: ContractMetro[], preferred = "cleveland-oh"): string {
  if (metros.some((m) => m.slug === preferred)) return preferred;
  return metros[0]?.slug ?? preferred;
}

/** The metro slug encoded in a URL hash (e.g. "#austin-tx" or "#/austin-tx"), if it names a metro. */
// @spec APP-UI-013
export function slugFromHash(hash: string, metros: ContractMetro[]): string | null {
  const s = hash.replace(/^#\/?/, "").trim();
  return metros.some((m) => m.slug === s) ? s : null;
}
