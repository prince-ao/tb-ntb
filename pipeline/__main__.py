"""CLI entry point: ``python -m pipeline --out <path>``.

Reads ``pipeline/config/sources.yaml``, runs the stages, prints the run report, writes a
schema-valid ``metros.json`` to ``--out`` (default: repo-root ``metros.json``), and exits
non-zero on any failure.

@spec PIPE-PROC-011
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .errors import PipelineError
from .run import run

_PKG = Path(__file__).resolve().parent
_REPO = _PKG.parent


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pipeline", description="Emit metros.json (contract v4).")
    parser.add_argument("--out", default=str(_REPO / "metros.json"))
    parser.add_argument("--config", default=str(_PKG / "config" / "sources.yaml"))
    parser.add_argument("--schema", default=str(_REPO / "contract" / "metros.schema.json"))
    args = parser.parse_args(argv)

    try:
        report = run(args.config, args.schema, args.out)
    except PipelineError as exc:
        print(f"ETL FAILED — published nothing: {exc}", file=sys.stderr)
        return 1
    print(report.format(), file=sys.stderr)
    print(f"ETL ok: {report.final_n} metros -> {args.out}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
