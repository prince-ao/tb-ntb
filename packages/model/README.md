# @tb-ntb/model — the financial model

The engine: given a metro's facts and a set of assumptions, project buyer vs. renter net worth
year by year and find the breakeven. Pure functions, no I/O, cheap enough to run on every slider
move. This is the highest-correctness-value segment — it is where a wrong formula silently
produces a confident wrong answer.

- **Interface (the seam):** `src/index.ts` — types + signatures the app depends on.
- **Design:** `agent-docs/llds/financial-model.md`
- **Specs:** `agent-docs/specs/model.md` (prefix `MODEL`)

## Why per-year rate schedules

`appreciation`, `rentGrowth`, and `investmentReturn` accept either a scalar or a per-year array.
The array form is what lets the user move a projection *year by year* (e.g. 5% appreciation for
three years, then 2%). Keep this in the core — do not push it into the UI.

## Working on it in isolation

Needs no external data and no pipeline — construct a `Metro` by hand (or read the fixture) and
assert on `project(...)`. Start from `agent-docs/llds/financial-model.md`, then write failing tests
carrying `@spec MODEL-...` before implementing.
