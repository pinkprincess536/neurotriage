import os
import json
import copy
import tempfile
from collections import defaultdict
from datetime import datetime, timezone

import numpy as np
import torch
import torch.nn as nn

from eeg_core import process_edf


def _read_config(model_dir):
    config_path = os.path.join(model_dir, "model_config.json")
    with open(config_path) as f:
        return json.load(f)


def _write_config(model_dir, config):
    config_path = os.path.join(model_dir, "model_config.json")
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)


def migrate_config(model_dir):
    config = _read_config(model_dir)
    if "versions" in config:
        return

    old_weights = os.path.join(model_dir, "eegcnn1d_weights.pth")
    v1_weights = os.path.join(model_dir, "eegcnn1d_weights_v1.pth")
    if os.path.exists(old_weights) and not os.path.exists(v1_weights):
        import shutil
        shutil.copy2(old_weights, v1_weights)

    config["active_version"] = "v1"
    config["versions"] = [{
        "version": "v1",
        "type": "original",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }]
    _write_config(model_dir, config)


def get_active_version(model_dir="model"):
    config = _read_config(model_dir)
    return config.get("active_version", "v1")


def get_active_version_num(model_dir="model"):
    ver = get_active_version(model_dir)
    return int(ver.replace("v", ""))


def get_next_version_num(model_dir="model"):
    config = _read_config(model_dir)
    versions = config.get("versions", [])
    if not versions:
        return 2
    nums = [int(v["version"].replace("v", "")) for v in versions]
    return max(nums) + 1


def list_versions(model_dir="model"):
    config = _read_config(model_dir)
    return {
        "active_version": config.get("active_version", "v1"),
        "versions": config.get("versions", []),
    }


def weights_path_for_version(model_dir, version_str):
    return os.path.join(model_dir, f"eegcnn1d_weights_{version_str}.pth")


def activate_model(model, model_dir, version_str, device):
    path = weights_path_for_version(model_dir, version_str)
    if not os.path.exists(path):
        raise ValueError(f"Weights file not found for {version_str}")

    config = _read_config(model_dir)
    known = [v["version"] for v in config.get("versions", [])]
    if version_str not in known:
        raise ValueError(f"Unknown version {version_str}")

    state_dict = torch.load(path, map_location=device)
    model.load_state_dict(state_dict)
    model.eval()

    config["active_version"] = version_str
    _write_config(model_dir, config)

    return version_str


def fetch_feedback_dataset(supabase):
    feedback_res = supabase.table("feedback").select("*").not_.is_("recording_id", "null").execute()
    entries = feedback_res.data
    if not entries:
        return [], {}

    recording_ids = list({e["recording_id"] for e in entries})
    recordings = {}
    for rid in recording_ids:
        rec = supabase.table("recordings").select("*").eq("id", rid).execute()
        if rec.data:
            recordings[rid] = rec.data[0]

    return entries, recordings


def download_edf_from_storage(supabase, storage_path, dest_path):
    data = supabase.storage.from_("eeg-recordings").download(storage_path)
    with open(dest_path, "wb") as f:
        f.write(data)


def build_training_data(supabase, train_mean, train_std):
    entries, recordings = fetch_feedback_dataset(supabase)
    if not entries:
        raise ValueError("No feedback with valid recording_id found")

    by_recording = defaultdict(list)
    for e in entries:
        if e["recording_id"] in recordings:
            by_recording[e["recording_id"]].append(e)

    all_windows = []
    all_labels = []
    skipped = 0

    for recording_id, fb_list in by_recording.items():
        rec = recordings[recording_id]
        storage_path = rec["storage_path"]

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".edf")
        tmp.close()
        try:
            download_edf_from_storage(supabase, storage_path, tmp.name)
            windows, timestamps, _ = process_edf(tmp.name)

            for fb in fb_list:
                target_ts = fb["timestamp_sec"]
                diffs = np.abs(timestamps - target_ts)
                closest_idx = int(np.argmin(diffs))

                if diffs[closest_idx] > 5.0:
                    skipped += 1
                    continue

                label = 1 if fb["doctor_label"] in ("seizure", "abnormal") else 0
                all_windows.append(windows[closest_idx])
                all_labels.append(label)
        finally:
            os.unlink(tmp.name)

    if not all_windows:
        raise ValueError(f"No matching windows found (skipped {skipped})")

    X = np.array(all_windows, dtype=np.float32)
    y = np.array(all_labels, dtype=np.int64)
    return X, y, skipped


def fine_tune(model, X, y, train_mean, train_std, device,
              lr=0.0001, epochs=5, batch_size=8):
    mean_2d = train_mean.squeeze(0)
    std_2d = train_std.squeeze(0)
    if mean_2d.ndim == 2:
        mean_2d = mean_2d[:, :1]
        std_2d = std_2d[:, :1]

    X_norm = (X - mean_2d) / (std_2d + 1e-8)

    n_pos = int((y == 1).sum())
    n_neg = int((y == 0).sum())
    if n_pos > 0 and n_neg > 0:
        weight = torch.tensor([1.0, n_neg / n_pos], dtype=torch.float32).to(device)
    else:
        weight = torch.tensor([1.0, 1.0], dtype=torch.float32).to(device)

    criterion = nn.CrossEntropyLoss(weight=weight)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    model.train()
    n = len(X_norm)
    history = []

    for epoch in range(epochs):
        indices = np.random.permutation(n)
        epoch_loss = 0.0
        correct = 0

        for start in range(0, n, batch_size):
            batch_idx = indices[start:start + batch_size]
            xb = torch.tensor(X_norm[batch_idx], dtype=torch.float32).to(device)
            yb = torch.tensor(y[batch_idx], dtype=torch.long).to(device)

            optimizer.zero_grad()
            out = model(xb)
            loss = criterion(out, yb)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item() * len(batch_idx)
            correct += (out.argmax(1) == yb).sum().item()

        history.append({
            "epoch": epoch + 1,
            "loss": round(epoch_loss / n, 4),
            "accuracy": round(correct / n, 4),
        })

    model.eval()
    return history


def save_retrained_model(train_model, model_dir, new_version_num, training_samples):
    version_str = f"v{new_version_num}"
    path = weights_path_for_version(model_dir, version_str)
    torch.save(train_model.state_dict(), path)

    config = _read_config(model_dir)
    config.setdefault("versions", [])
    config["versions"].append({
        "version": version_str,
        "type": "retrained",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "training_samples": training_samples,
    })
    _write_config(model_dir, config)


def run_retrain(model, train_mean, train_std, device, supabase,
                model_dir="model", lr=0.0001, epochs=5):
    X, y, skipped = build_training_data(supabase, train_mean, train_std)

    train_model = copy.deepcopy(model)

    history = fine_tune(train_model, X, y, train_mean, train_std, device,
                        lr=lr, epochs=epochs)

    new_version_num = get_next_version_num(model_dir)
    save_retrained_model(train_model, model_dir, new_version_num, len(X))

    return {
        "new_version": f"v{new_version_num}",
        "activated": False,
        "training_samples": len(X),
        "seizure_samples": int((y == 1).sum()),
        "normal_samples": int((y == 0).sum()),
        "skipped_entries": skipped,
        "history": history,
    }
