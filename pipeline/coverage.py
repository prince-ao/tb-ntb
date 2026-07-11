"""Coverage intersection — pure, stdlib only."""

from __future__ import annotations

from collections.abc import Mapping
from typing import NamedTuple


class Coverage(NamedTuple):
    included: list[str]  # RegionIDs that pass all three gates (sorted)
    drops: dict[str, str]  # RegionID -> reason (missing ZORI, no state rate, ...)


def intersect(
    home_values: Mapping[str, float],
    rents: Mapping[str, float],
    state_by_region: Mapping[str, str],
    tax_by_state: Mapping[str, float],
) -> Coverage:
    """A metro is included iff it has a home value, a rent, and its primary state has a tax
    rate (the 50-state table). Everything excluded is recorded in ``drops`` with a reason —
    no silent drops. Coverage misses are not run failures.

    @spec PIPE-PROC-003, PIPE-OBS-002
    """
    included: list[str] = []
    drops: dict[str, str] = {}
    region_ids = set(home_values) | set(rents) | set(state_by_region)
    for rid in region_ids:
        if rid not in home_values:
            drops[rid] = "missing ZHVI"
        elif rid not in rents:
            drops[rid] = "missing ZORI"
        elif rid not in state_by_region:
            drops[rid] = "missing state"
        elif state_by_region[rid] not in tax_by_state:
            drops[rid] = f"no state rate ({state_by_region[rid]})"
        else:
            included.append(rid)
    return Coverage(included=sorted(included), drops=drops)
