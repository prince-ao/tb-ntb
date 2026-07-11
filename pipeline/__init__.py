"""tb-ntb data pipeline (PIPE) — config-driven ETL that emits metros.json (contract v4).

Design: agent-docs/llds/data-pipeline.md · Specs: agent-docs/specs/pipeline.md (prefix PIPE).

The pure core (derive, quality, rates, coverage, config-preflight, build) has no third-party
imports; pandas/network live only in `adapters` and are imported lazily.
"""

__version__ = "0.1.0"

# The contract major this pipeline is built to. Bumping the SCHEMA contract is a coordinated
# cascade that updates this constant (config preflight checks sources.yaml against it).
CONTRACT_VERSION = "5.0.0"
