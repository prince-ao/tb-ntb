# Infrastructure (INFRA)

> **Status: skeleton.** Narrowed by the 2026-07-03 segmentation decision (see below).

## Context and Design Philosophy

The **cross-cutting** glue, for **$0**: continuous integration and the LID coherence tooling, under
the binding constraint that every choice fit a free tier. INFRA does **not** own subsystem-specific
execution — the ETL's own GitHub Actions run + publish is **PIPE's** (`etl.yml`, `PIPE-PROC-006` /
`PIPE-PROC-012`), and the app's Pages build/deploy is **APP's** (`deploy-pages.yml`,
`APP-DEPLOY-001`). A segment owning a workflow but not the thing it runs was a fake seam.

## Pieces

- **`ci.yml`** — on push/PR: run the model, app, and pipeline tests, validate the fixture against the
  schema, and run the LID coherence check.
- **Coherence-check script** *(TODO)* — `@spec` IDs resolve to real specs, cited specs have tests, no
  dangling IDs. Register under `CLAUDE.md § LID Tooling` once built.

*(Not INFRA: `etl.yml` → PIPE; `deploy-pages.yml` → APP.)*

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| ETL host | GitHub Actions cron | Paid scheduler / server | Free; native cron. (The ETL workflow itself is PIPE's.) |
| App host | GitHub Pages | Vercel | $0 NFR. (The deploy workflow itself is APP's.) |
| INFRA scope | Cross-cutting CI + LID coherence tooling | INFRA also owns the ETL workflow + data delivery | Producing and publishing `metros.json` is one cohesive PIPE job; splitting it across segments was artificial. |

## Open Questions & Future Decisions

### Deferred
1. Whether to pin runner versions / cache deps for CI speed.
2. Building the coherence-check script (register under `CLAUDE.md § LID Tooling`).

*(The data-delivery mechanism and ETL cadence moved to PIPE — see `agent-docs/llds/data-pipeline.md`.)*

## References
- `.github/workflows/ci.yml`, `CLAUDE.md § LID Tooling`, `agent-docs/specs/infra.md`
