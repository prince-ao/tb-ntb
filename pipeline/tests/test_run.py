import pytest

from pipeline import __main__ as cli
from pipeline.errors import PipelineError
from pipeline.run import RunReport, run


# @spec PIPE-PROC-005, PIPE-QUAL-006
def test_run_publishes_nothing_on_failure(tmp_path):
    out = tmp_path / "metros.json"
    with pytest.raises(PipelineError):
        run(str(tmp_path / "missing.yaml"), "schema.json", str(out))
    assert not out.exists()  # last good stays live; no partial file


# @spec PIPE-OBS-001
def test_run_report_has_stage_counts_and_drops():
    r = RunReport()
    assert r.final_n == 0
    assert r.drops == {}
    assert r.mortgage_rate is None and r.current_inflation is None


# @spec PIPE-PROC-011
def test_cli_exits_nonzero_on_failure(tmp_path):
    # A bad --config fails fast (before any fetch); the CLI returns non-zero and writes nothing.
    out = tmp_path / "out.json"
    rc = cli.main(["--config", str(tmp_path / "nope.yaml"), "--out", str(out)])
    assert rc != 0
    assert not out.exists()
