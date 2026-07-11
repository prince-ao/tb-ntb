import json

import pytest

from pipeline.build import assemble, load_defaults, validate, write_atomic
from pipeline.errors import SchemaValidationError


# @spec PIPE-PROC-008
def test_assemble_orders_metros_by_slug():
    metros = [{"slug": "denver-co"}, {"slug": "austin-tx"}]
    obj = assemble("3.0.0", "2026-07-01", {}, {}, metros)
    assert [m["slug"] for m in obj["metros"]] == ["austin-tx", "denver-co"]


# @spec PIPE-DEF-001, PIPE-PROC-004
def test_committed_sample_validates(sample, schema):
    pytest.importorskip("jsonschema")
    validate(sample, schema)  # the fixed v4 fixture is valid — must not raise


# @spec PIPE-PROC-004
def test_validate_rejects_scalar_mortgage_rate(sample, schema):
    pytest.importorskip("jsonschema")
    bad = json.loads(json.dumps(sample))
    bad["defaults"]["mortgageRate"] = 0.068  # v5 requires the term-indexed object {30, 15}
    with pytest.raises(SchemaValidationError):
        validate(bad, schema)


# @spec PIPE-DEF-002
def test_load_defaults_serializes_verbatim(tmp_path, authored_defaults):
    yaml = pytest.importorskip("yaml")
    p = tmp_path / "defaults.yaml"
    p.write_text(yaml.safe_dump(authored_defaults))
    assert load_defaults(str(p)) == authored_defaults


# @spec PIPE-QUAL-005
def test_write_atomic_leaves_no_temp_and_writes_valid_json(tmp_path):
    out = tmp_path / "metros.json"
    write_atomic({"ok": True}, str(out))
    assert json.loads(out.read_text()) == {"ok": True}
    assert list(tmp_path.iterdir()) == [out]  # no leftover temp file
