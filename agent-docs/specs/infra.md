# EARS Specs — Infrastructure (INFRA)

> **Status: seed.** INFRA is the **cross-cutting** segment — CI, the LID coherence tooling, and the
> $0 cost NFR. Per the 2026-07-03 segmentation decision it does **not** own the ETL's own
> execution/publish (PIPE: `PIPE-PROC-006`, `PIPE-PROC-012`) or the app's Pages deploy
> (APP: `APP-DEPLOY-001`).

## Cost & hosting

- [ ] **INFRA-PROC-001**: The system shall run entirely on free tiers — ETL on GitHub Actions, app on GitHub Pages — with no paid hosting or paid data.

## CI / coherence

- [ ] **INFRA-PROC-004**: On each push and pull request, the system (CI) shall run the model, app, and pipeline tests.
- [ ] **INFRA-PROC-005**: On each push and pull request, the system (CI) shall validate `contract/metros.sample.json` against the schema.
- [ ] **INFRA-PROC-006**: The system shall provide a coherence check that verifies every `@spec` annotation cites an existing spec ID and every behavioral spec cited by an LLD has at least one test.

> **Re-homed (IDs not reused):** `INFRA-PROC-002` (deploy the app → `APP-DEPLOY-001`) and
> `INFRA-PROC-003` (run + publish the ETL → `PIPE-PROC-006`/`PIPE-PROC-012`). The data-delivery
> mechanism moved with the ETL to PIPE.
