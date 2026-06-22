import argparse

import numpy as np

from eeg_core import load_model, process_edf, score_windows, WINDOW_SIZE_SEC, OVERLAP


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

    stride_sec = WINDOW_SIZE_SEC * (1 - OVERLAP)
    windows_per_hour = 3600 / stride_sec
    est_per_hour = n_flagged / n_total * windows_per_hour if n_total else 0

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

    model, train_mean, train_std, device, _ = load_model(args.model)
    windows, timestamps, _ = process_edf(args.edf)
    scores = score_windows(model, windows, train_mean, train_std, device)
    display_results(scores, timestamps, args.threshold, args.output)


if __name__ == "__main__":
    main()
