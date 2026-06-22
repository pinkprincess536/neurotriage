import json

from retrain import check_promotion_gate


def _make_model_dir(tmp_path, versions, active="v1"):
    cfg = {"versions": versions, "active_version": active}
    (tmp_path / "model_config.json").write_text(json.dumps(cfg))
    return str(tmp_path)


def test_promotion_gate_blocks_worse(tmp_path):
    model_dir = _make_model_dir(tmp_path, [
        {"version": "v1", "type": "original", "metrics": {"recall": 0.59, "specificity": 0.95}},
        {"version": "v2", "type": "retrained", "metrics": {"recall": 0.16, "specificity": 1.0}},
    ])
    gate = check_promotion_gate(model_dir, "v2")
    assert gate["ok"] is False


def test_promotion_gate_allows_better(tmp_path):
    model_dir = _make_model_dir(tmp_path, [
        {"version": "v1", "type": "original", "metrics": {"recall": 0.59, "specificity": 0.95}},
        {"version": "v2", "type": "retrained", "metrics": {"recall": 0.70, "specificity": 0.94}},
    ])
    gate = check_promotion_gate(model_dir, "v2")
    assert gate["ok"] is True


def test_promotion_gate_original_always_ok(tmp_path):
    model_dir = _make_model_dir(tmp_path, [
        {"version": "v1", "type": "original", "metrics": {"recall": 0.59, "specificity": 0.95}},
    ])
    assert check_promotion_gate(model_dir, "v1")["ok"] is True


def test_promotion_gate_no_metrics_skipped(tmp_path):
    model_dir = _make_model_dir(tmp_path, [
        {"version": "v1", "type": "original", "metrics": {"recall": 0.59, "specificity": 0.95}},
        {"version": "v2", "type": "retrained"},
    ])
    assert check_promotion_gate(model_dir, "v2")["ok"] is True
