# contract/ — the data seam

This is the one place the two subsystems meet. Agree it, and the pipeline and the app can be
built in parallel without talking to each other.

- `metros.schema.json` — the shape of `metros.json` (JSON Schema, draft 2020-12).
- `metros.sample.json` — a committed fixture (fake but plausible metros). The **app develops
  against this** so it never waits on the pipeline. The **pipeline's job** is to emit a real
  file that validates against the schema.

## The contract carries facts, not decisions

It holds *observed data about a metro* (price, rent, tax rate) and the *current mortgage rate*.
It deliberately does **not** carry:

- **Assumptions** (down payment, maintenance, appreciation scenarios, investment return, …) —
  those are user-owned dials that live in the app/model, not properties of a metro.
- **Model outputs** (net-worth arrays, breakeven) — those are computed live in the browser.

This split is what keeps the model a pure function of `(metro facts, assumptions)`.

## Changing the contract

A change here is a `SCHEMA`-segment change and ripples to `PIPE` and `APP`. Bump
`schemaVersion`, update the fixture, and coordinate the cascade — don't edit it casually.

## Owning segment

`SCHEMA` — see `agent-docs/llds/data-contract.md` and `agent-docs/specs/schema.md`.
