# tb-ntb — Rent vs. Buy Longitudinal Tool

Real-time-adjustable projection of whether buying or renting a home wins financially,
1–10 years out, per US metro. Two subsystems joined by one narrow data contract.

## LID Mode: Full

Every change that could alter behavior walks the arrow: HLD → LLD → EARS → tests → code,
with a review stop at each boundary. See the `linked-intent-dev` skill.

- HLD: `agent-docs/high-level-design.md`
- LLDs: `agent-docs/llds/`
- EARS specs: `agent-docs/specs/`
- The two seams that make parallel work possible: `contract/` (data) and
  `packages/model` (the model's function signatures).

## LID Tooling

- Coherence check: *(not yet built — INFRA workstream, see `agent-docs/PARALLEL-WORKSTREAMS.md`)*.
  Until it exists, structural coherence checks are performed in-prompt.

## Assumed architectural decisions (UNCONFIRMED — pending user review)

These four were chosen as defaults while the user was away. Each is reversible; the
reasoning lives in `agent-docs/high-level-design.md § Key Design Decisions`.

1. **Compute runs client-side** — the model runs in the browser; there is no compute
   backend. The batch "backend" (data gathering) is GitHub Actions.
2. **Pipeline is Python + pandas** — best fit for the wide Zillow CSV reshape. The
   pipeline emits *data only*; it does not run the model, so its language is decoupled
   from the model's.
3. **Single monorepo** — one repo, several packages, one shared contract.
4. **Full LID** — the discipline applies everywhere.

If you overturn any of these, the affected scaffolding is small and clearly isolated.

## Layout

```
contract/        The data seam: metros.json schema + committed sample fixture.
packages/model/  The financial model. Pure functions, no I/O. Runs in the browser.
packages/app/    The web app (GitHub Pages). Loads the data, runs the model live.
pipeline/        The config-driven ETL (GitHub Actions, cron). Emits metros.json.
agent-docs/      HLD, LLDs, EARS specs, the parallel-workstreams guide.
.github/         ETL cron, Pages deploy, and CI workflows.
```

## Principles (from the user, binding)

- No cargo-culting — don't add a component (a backend, a framework, a queue) unless
  something concretely needs it. The model is microseconds; it does not need a server.
- Plain language over jargon.
- Deep modules, narrow interfaces (A Philosophy of Software Design). The data contract
  and the model signatures are the narrow interfaces; each subsystem hides its own mess.
- Built for parallel agents: the seams are agreed first so subsystems don't block.

## Segment prefixes (EARS ID namespaces)

`SCHEMA` (data contract) · `PIPE` (ETL **+ its GitHub Actions execution & publish**) ·
`MODEL` (financial model) · `APP` (frontend **+ its Pages deploy**) ·
`INFRA` (**cross-cutting** CI / LID coherence tooling / $0 NFR). One prefix = one arrow segment.
