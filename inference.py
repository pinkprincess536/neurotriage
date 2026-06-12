import argparse
import json
import os

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


EEG_CHANNELS = [
    "FP1-F7", "F7-T7", "T7-P7", "P7-O1",
    "FP1-F3", "F3-C3", "C3-P3", "P3-O1",
    "FP2-F4", "F4-C4", "C4-P4", "P4-O2",
    "FP2-F8", "F8-T8", "T8-P8", "P8-O2",
    "FZ-CZ", "CZ-PZ",
    "P7-T7", "T7-FT9", "FT9-FT10", "FT10-T8",
]

WINDOW_SIZE_SEC = 7.0
OVERLAP = 0.3
LOWCUT = 0.5
HIGHCUT = 40.0
NOTCH_FREQ = 60.0


class EEGCNN1D(nn.Module):
    def __init__(self, n_channels=22, n_classes=2):
        super().__init__()
        self.conv1 = nn.Conv1d(n_channels, 32, kernel_size=7, padding=3)
        self.bn1 = nn.BatchNorm1d(32)
        self.pool1 = nn.MaxPool1d(4)

        self.conv2 = nn.Conv1d(32, 64, kernel_size=5, padding=2)
        self.bn2 = nn.BatchNorm1d(64)
        self.pool2 = nn.MaxPool1d(4)

        self.conv3 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm1d(128)
        self.adapt = nn.AdaptiveAvgPool1d(16)

        self.drop1 = nn.Dropout(0.4)
        self.fc1 = nn.Linear(128 * 16, 64)
        self.drop2 = nn.Dropout(0.3)
        self.fc2 = nn.Linear(64, n_classes)

    def forward(self, x):
        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.pool2(F.relu(self.bn2(self.conv2(x))))
        x = F.relu(self.bn3(self.conv3(x)))
        x = self.adapt(x)
        x = torch.flatten(x, 1)
        x = self.drop1(x)
        x = F.relu(self.fc1(x))
        x = self.drop2(x)
        x = self.fc2(x)
        return x


def load_model(model_dir):
    config_path = os.path.join(model_dir, "model_config.json")
    weights_path = os.path.join(model_dir, "eegcnn1d_weights.pth")
    mean_path = os.path.join(model_dir, "train_mean.npy")
    std_path = os.path.join(model_dir, "train_std.npy")

    with open(config_path, "r") as f:
        config = json.load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = EEGCNN1D(n_channels=config.get("n_channels", 22))
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.to(device)
    model.eval()

    train_mean = np.load(mean_path)
    train_std = np.load(std_path)

    print(f"Loaded EEGCNN1D ({config.get('n_channels', 22)} channels)")
    return model, train_mean, train_std, device


def process_edf(edf_path):
    import mne

    raw = mne.io.read_raw_edf(edf_path, preload=True, verbose=False)
    sfreq = raw.info["sfreq"]

    available = raw.ch_names
    channels_to_use = [ch for ch in EEG_CHANNELS if ch in available]
    if len(channels_to_use) < 18:
        raise ValueError(
            f"Only {len(channels_to_use)} matching channels found. Need at least 18."
        )

    raw.pick_channels(channels_to_use)
    raw.filter(LOWCUT, HIGHCUT, fir_design="firwin", verbose=False)
    raw.notch_filter(freqs=NOTCH_FREQ, verbose=False)
    signal = raw.get_data()
    n_chan = signal.shape[0]

    ws = int(WINDOW_SIZE_SEC * sfreq)
    stride = int(ws * (1 - OVERLAP))
    total = signal.shape[1]

    windows = []
    timestamps = []
    for start in range(0, total - ws + 1, stride):
        windows.append(signal[:, start:start + ws])
        timestamps.append(start / sfreq)

    windows = np.array(windows, dtype=np.float32)
    timestamps = np.array(timestamps)

    if n_chan < len(EEG_CHANNELS):
        pad = np.zeros(
            (windows.shape[0], len(EEG_CHANNELS) - n_chan, windows.shape[2]),
            dtype=np.float32,
        )
        windows = np.concatenate([windows, pad], axis=1)
    elif n_chan > len(EEG_CHANNELS):
        windows = windows[:, : len(EEG_CHANNELS), :]

    duration_sec = total / sfreq
    print(
        f"Processing {os.path.basename(edf_path)}..."
        f"  {windows.shape[0]} windows from {int(duration_sec // 60)}:{int(duration_sec % 60):02d} recording"
    )

    return windows, timestamps


def score_windows(model, windows, train_mean, train_std, device):
    train_mean_flat = train_mean.squeeze(0)
    train_std_flat = train_std.squeeze(0)

    if train_mean_flat.ndim != 2:
        if train_mean_flat.ndim == 3 and train_mean_flat.shape[0] == 1:
            train_mean_flat = train_mean_flat[0]
            train_std_flat = train_std_flat[0]
        elif train_mean_flat.ndim == 3:
            train_mean_flat = train_mean_flat.mean(axis=0)
            train_std_flat = train_std_flat.mean(axis=0)

    if train_mean_flat.ndim == 2:
        normalizer_mean = train_mean_flat[:, :1]
        normalizer_std = train_std_flat[:, :1]
    else:
        normalizer_mean = np.expand_dims(train_mean_flat, axis=1)
        normalizer_std = np.expand_dims(train_std_flat, axis=1)

    X = (windows - normalizer_mean) / (normalizer_std + 1e-8)

    X_tensor = torch.tensor(X, dtype=torch.float32).to(device)

    with torch.no_grad():
        outputs = model(X_tensor)
        probs = torch.softmax(outputs, dim=1)[:, 1]

    return probs.cpu().numpy()


def display_results(scores, timestamps, threshold, output_csv=None):
    above = scores >= threshold
    indices = np.where(above)[0]
    order = indices[np.argsort(-scores[indices])]

    print(f"\n  {'Rank':<6} {'Timestamp':<12} {'Score':<8} Tier")
    print("  " + "-" * 40)

    for rank, idx in enumerate(order, 1):
        mins = int(timestamps[idx] // 60)
        secs = int(timestamps[idx] % 60)
        ts = f"{mins:02d}:{secs:02d}"
        if scores[idx] >= 0.95:
            tier = "🔴"
        elif scores[idx] >= 0.50:
            tier = "🟡"
        else:
            tier = "⬜"
        print(f"  {rank:<6} {ts:<12} {scores[idx]:.3f}     {tier}")

    n_flagged = len(order)
    n_total = len(scores)
    pct = 100 * n_flagged / n_total if n_total else 0

    window_sec = WINDOW_SIZE_SEC
    stride_sec = window_sec * (1 - OVERLAP)
    windows_per_hour = 3600 / stride_sec
    est_per_hour = n_flagged / n_total * windows_per_hour

    print(f"\n  {n_flagged} / {n_total} windows flagged above threshold {threshold:.2f} ({pct:.1f}%)")
    print(f"  Estimated: {est_per_hour:.0f} flagged per hour")

    if output_csv and n_flagged > 0:
        with open(output_csv, "w") as f:
            f.write("rank,timestamp_seconds,timestamp,score\n")
            for rank, idx in enumerate(order, 1):
                f.write(f"{rank},{timestamps[idx]:.1f},"
                        f"{int(timestamps[idx] // 60):02d}:{int(timestamps[idx] % 60):02d},"
                        f"{scores[idx]:.4f}\n")
        print(f"  Saved to {output_csv}")


def main():
    parser = argparse.ArgumentParser(description="EEG Seizure Triage — Inference")
    parser.add_argument("--edf", required=True, help="Path to .edf file")
    parser.add_argument("--model", required=True, help="Path to model directory")
    parser.add_argument("--threshold", type=float, default=0.70,
                        help="Seizure probability threshold (default: 0.70)")
    parser.add_argument("--output", help="Save flagged windows to CSV (optional)")
    args = parser.parse_args()

    model, train_mean, train_std, device = load_model(args.model)
    windows, timestamps = process_edf(args.edf)
    scores = score_windows(model, windows, train_mean, train_std, device)
    display_results(scores, timestamps, args.threshold, args.output)


if __name__ == "__main__":
    main()
