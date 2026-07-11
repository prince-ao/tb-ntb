#!/usr/bin/env bash
# Run Python inside the project's virtualenv, bootstrapping it on first use.
#
#   scripts/py.sh -m pipeline          run the ETL (emits metros.json)
#   scripts/py.sh -m pytest pipeline/tests   run the pipeline test suite
#
# The venv lives at .venv/ (gitignored) and holds the pipeline's runtime + dev deps.
# Interpreter: prefers python3.12 (matches CI) unless $TBNTB_PYTHON is set. This is
# INFRA dev tooling — it does not run the model or change any product behavior.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/.venv"
PY="$VENV/bin/python"

pick_python() {
  if [ -n "${TBNTB_PYTHON:-}" ]; then echo "$TBNTB_PYTHON"; return; fi
  for c in python3.12 python3; do
    command -v "$c" >/dev/null 2>&1 && { echo "$c"; return; }
  done
  echo "python3"
}

if [ ! -x "$PY" ]; then
  BOOT_PY="$(pick_python)"
  echo "› First run: creating .venv with $BOOT_PY and installing pipeline deps…" >&2
  "$BOOT_PY" -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r "$ROOT/pipeline/requirements-dev.txt"
  echo "› .venv ready ($("$PY" --version 2>&1))." >&2
fi

cd "$ROOT"          # so `python -m pipeline` / `pytest pipeline` resolve regardless of caller cwd
exec "$PY" "$@"
