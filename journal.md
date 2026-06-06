# Learning Journal — EEG Seizure Triage Project

---

## 1. Normalization (Z-Score Normalization)

### What is it?
Transforming data so every feature has mean=0 and standard deviation=1.

Formula: `X_normalized = (X - mean) / std`

### Why use it?
Raw numbers from different sources have different scales. Normalization puts everything on the same scale so the model learns patterns, not scale differences.

### Analogy
You're baking a cake by someone else's recipe. It says "2 cups of flour." If your measuring cup is a different size, the cake fails. `train_mean` and `train_std` are the cup size — use the same cup every time or the recipe breaks.

### What happens without it?
- Model can't generalize to new patients
- Channels with larger raw amplitudes dominate training
- Gradients become unstable

### Real-world applications
| Domain | What's normalized |
|--------|-------------------|
| EEG | Voltage amplitudes across channels/patients |
| Stock prices | Price changes (percentages, not raw dollars) |
| Face recognition | Brightness/contrast across photos |
| Voice assistants | Audio volume levels |
| Medical imaging (MRI/CT) | Pixel intensities across machines |
| Recommendation systems | User rating behavior (some give all 5s, some never do) |

### Critical rule
Always save the normalization stats from training. Apply the **same** stats at inference. Never recompute from new data.

---

## 2. Pipeline Persistence (Saving Everything)

### The problem
If you train a model but don't save the normalization stats, model weights, and config — you can never use it again. Kaggle/Colab sessions die and everything is lost.

### What must be saved after every run

| Artifact | File | Why |
|----------|------|-----|
| Model weights | `eegcnn1d_weights.pth` | To reload and run inference |
| Model config | `model_config.json` | To rebuild the same architecture |
| Test metrics | `test_metrics.json` | To compare runs over time |
| Norm mean | `train_mean.npy` | To normalize new EEG the same way |
| Norm std | `train_std.npy` | Same as above |
| Channel names | `channel_names.npy` | To match channels at inference |

### Checklist after a run
- [ ] Model weights downloaded before Kaggle session ends
- [ ] Config + metrics saved
- [ ] Norm stats saved alongside processed data
- [ ] Metrics recorded somewhere for comparison

---

## 3. DVC (Data Version Control)

### What is it?
DVC = Git for large files. Git tracks small `.dvc` metadata files; DVC stores the actual large files (`.npy`, `.edf`) in remote storage (Google Drive, S3, etc.).

### The right setup
- **Git (GitHub)**: tracks code + `.dvc` pointer files
- **DVC remote**: stores actual data blobs (Drive, S3, Kaggle Dataset)
- When someone clones the repo, they run `dvc pull` to download data

### The wrong setup (current)
- DVC runs in a separate `git init` inside Google Drive
- `.dvc` files never reach GitHub
- No one else can reproduce the pipeline

### Key commands
```bash
dvc add processed/*.npy      # Track data files
git add processed/*.dvc      # Commit pointers to Git
git commit -m "dataset v2"
dvc push                      # Upload data to remote
git push                      # Push pointers to GitHub
```

---

*Updated: June 2026*
