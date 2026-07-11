from pipeline.coverage import intersect


# @spec PIPE-PROC-003
def test_intersect_includes_only_metros_with_all_three():
    home = {"1": 450_000, "2": 1_150_000, "3": 215_000}
    rent = {"1": 1850, "2": 3400}  # metro 3 has no rent
    state = {"1": "TX", "2": "CA", "3": "OH"}
    tax = {"TX": 0.017, "CA": 0.007}  # metro 3's state has a tax too, but no rent
    cov = intersect(home, rent, state, tax)
    assert set(cov.included) == {"1", "2"}
    assert "3" in cov.drops  # dropped, and the reason is recorded (not silent)


# @spec PIPE-PROC-003, PIPE-OBS-002
def test_dc_dropped_for_missing_state_rate():
    home = {"9": 700_000}
    rent = {"9": 2500}
    state = {"9": "DC"}  # 50-state table only
    tax = {"TX": 0.017}
    cov = intersect(home, rent, state, tax)
    assert cov.included == []
    assert "9" in cov.drops
