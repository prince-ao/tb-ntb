# @tb-ntb/app — the web app

One screen. Pick a metro, see the buy-vs-rent net-worth crossover over 10 years, the breakeven
year, and the exact assumptions used — then move any dial (including per-year) and watch it
recompute instantly. Deploys static to GitHub Pages.

- **Design:** `agent-docs/llds/web-app.md`
- **Specs:** `agent-docs/specs/app.md` (prefix `APP`)

## Two dependencies, both seams — never the pipeline

- Data: `contract/metros.sample.json` in development. In production it fetches the real
  `metros.json` the pipeline publishes. **Same shape → no code change.** The app is built and
  demoable with no pipeline in existence.
- Compute: `@tb-ntb/model` — imported and called on every interaction. No network for the
  simulation.

## Not yet decided (settle in the APP LLD)

- Static framework and chart library (the MVP artifact suggested Next.js + Recharts; anything
  that produces a static bundle for Pages is fine — this is an APP-segment decision).
- The exact set of exposed dials for v1 (metro, scenario, and the per-year appreciation control
  at minimum).

Assumptions defaults (down payment, maintenance, appreciation priors, etc.) live here, not in the
data contract. Anchor them to long-run fundamentals — never the recent trend (see the HLD).
