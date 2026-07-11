import pytest

from pipeline.config import preflight
from pipeline.errors import ConfigError

KINDS = frozenset({"wide_csv", "single_value", "yoy_rate", "per_state_lookup", "static_values"})


def _cfg(**over):
    cfg = {"schema_version": "3.0.0", "sources": {"home_values": {"kind": "wide_csv"}}}
    cfg.update(over)
    return cfg


# @spec PIPE-PROC-007
def test_preflight_ok():
    preflight(_cfg(), "3.0.0", KINDS, lambda _p: True)  # must not raise


# @spec PIPE-PROC-007
def test_preflight_rejects_schema_version_mismatch():
    with pytest.raises(ConfigError):
        preflight(_cfg(schema_version="1.0.0"), "3.0.0", KINDS, lambda _p: True)


# @spec PIPE-PROC-007
def test_preflight_rejects_unknown_kind():
    cfg = _cfg(sources={"mystery": {"kind": "wide_json"}})
    with pytest.raises(ConfigError):
        preflight(cfg, "3.0.0", KINDS, lambda _p: True)


# @spec PIPE-PROC-007
def test_preflight_rejects_missing_committed_file():
    cfg = _cfg(sources={"tax": {"kind": "per_state_lookup", "path": "state_tax_rates.yaml"}})
    with pytest.raises(ConfigError):
        preflight(cfg, "3.0.0", KINDS, lambda _p: False)  # file does not exist
