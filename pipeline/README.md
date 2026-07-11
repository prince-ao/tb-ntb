# pipeline/ — the config-driven ETL

A scheduled job (GitHub Actions, cron) that gathers public housing data and emits one
`metros.json` that validates against `contract/metros.schema.json`. It **computes no
decisions** — it assembles facts per metro. Python + pandas (the Zillow CSVs are wide; a
column per month — pandas `melt`/`merge` makes the reshape short).

- **Design:** `agent-docs/llds/data-pipeline.md`
- **Specs:** `agent-docs/specs/pipeline.md` (prefix `PIPE`)

## Config-driven

Sources are declared in `config/sources.yaml`, not hand-coded per source. A small generic
runner reads the config, fetches, reshapes, joins, and emits. Adding or swapping a source is a
config edit plus (only if the shape is new) a named adapter — not a rewrite. See the LLD.

## Coverage is discovered, not hand-picked

The shipped metro set is the intersection of good ZHVI coverage, good ZORI coverage, and a
state tax rate. The pipeline discovers that intersection and lets it define N (~100–150 metros).
Do not maintain a hand-curated city list.

## Output

Emits `metros.json` in the contract shape. Where it publishes (committed back to the repo, or a
Pages/artifact upload) is an INFRA decision — see `agent-docs/llds/infrastructure.md`.
