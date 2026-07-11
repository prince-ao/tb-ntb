import pytest

from pipeline.derive import assert_unique_slugs, slug, state_of
from pipeline.errors import SlugCollisionError


# @spec PIPE-PROC-010
@pytest.mark.parametrize(
    "name,expected",
    [
        ("Austin, TX", "austin-tx"),
        ("San Francisco, CA", "san-francisco-ca"),
        ("Kansas City, MO-KS", "kansas-city-mo-ks"),
    ],
)
def test_slug(name, expected):
    assert slug(name) == expected


# @spec PIPE-PROC-009
def test_state_from_statename_column_not_regionname():
    # RegionName carries "MO-KS"; the two-letter code must come from StateName.
    row = {"RegionName": "Kansas City, MO-KS", "StateName": "MO"}
    assert state_of(row) == "MO"


# @spec PIPE-QUAL-004
def test_slug_collision_raises():
    with pytest.raises(SlugCollisionError):
        assert_unique_slugs(["austin-tx", "denver-co", "austin-tx"])


# @spec PIPE-QUAL-004
def test_unique_slugs_ok():
    assert_unique_slugs(["austin-tx", "denver-co"])  # must not raise
