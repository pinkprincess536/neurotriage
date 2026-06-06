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

## 4. Normalization in Neural Networks

### Why neural networks need it

Two reasons:

**Fairness between inputs.** A neural network adds up numbers from all inputs. If input A sends ~200 and input B sends ~2, input A dominates every calculation — not because it matters more, but because its numbers are bigger. Normalization gives every input an equal starting voice.

**Speed and stability.** Neural networks learn through small corrections called gradients. If inputs are huge and uneven, gradients become wild:
- Too big → the model overshoots and never settles (like trying to tune a radio by spinning the dial as hard as you can)
- Too tiny → it learns nothing (like whispering directions to someone across a football field)

Normalized inputs around zero keep gradients steady and predictable.

### In your EEG project

**23 channels, unequal scales.** Your 1D CNN treats all 23 EEG channels equally, but physically they're not. Frontal channels might swing ±200 µV while temporal channels hover around ±30 µV. Without normalization, the loud channels drown out the quiet ones — the CNN learns "loud channel = important" instead of "seizure pattern = important."

**Patient mismatch at test time.** You train on chb01–chb11. Later, a doctor uploads chb24. That patient's raw voltages could be double or half what the model saw during training. Without the saved `train_mean`/`train_std`, the model sees alien numbers and can't recognize anything.

**Inference is blocked.** Right now your pipeline computes normalization stats and throws them away. When Phase 4 (FastAPI backend) arrives and a doctor uploads a recording, you have no way to normalize it. The entire deployed system is dead before it starts.

The fix: two extra `np.save()` lines in `preprocess.ipynb`.

---

## 5. Inference in ML Models

### Training vs Inference

| | Training | Inference |
|---|---|---|
| **When** | Past, offline | Present, real-time |
| **Data** | Labeled examples (seizure / non-seizure) | New, unseen data (unknown EEG) |
| **Goal** | Learn patterns and rules | Apply rules to make predictions |
| **Speed** | Hours or days (one-time) | Milliseconds to seconds (every time) |
| **Output** | A trained model file | A prediction (score, label, ranking) |

### Analogy

**Training** = studying for a driving test. You read the manual, practice, memorize signs. Takes weeks.

**Inference** = actually driving on the road. You see a stop sign and react instantly. You don't re-read the manual at every intersection.

> Training is the rehearsal. Inference is the performance. Without it, you're just a band that only practices in the garage.

### Real-life examples

| System | Training | Inference |
|--------|----------|-----------|
| **Gmail spam filter** | Trained on millions of emails labeled "spam" / "not spam" across years | Scans your new email the moment it arrives, decides in <1 second |
| **Phone face unlock** | Trained on millions of face images in a lab | Looks at your face every time you pick up your phone, decides instantly |
| **Netflix recommendations** | Trained on billions of watch-history events | Shows you suggestions the moment you open the app |
| **Google Translate** | Trained on millions of translated documents | Translates your sentence as you type |
| **Voice assistant (Siri/Alexa)** | Trained on thousands of hours of speech | Understands your "hey" command in real-time |

### In your EEG project

The full inference flow:

```
Doctor uploads recording (chb24, 1 hour of EEG)
        │
        ▼
Preprocessing  ─── slice into 5-second windows
        │
        ▼
Normalize  ─── using saved train_mean.npy / train_std.npy
        │
        ▼
Model (1D CNN)  ─── scores every window: 0.0 (normal) to 1.0 (seizure)
        │
        ▼
Rank & return  ─── top-N most seizure-like windows
        │
        ▼
Doctor reviews  ─── clicks "True seizure" or "Not a seizure"
        │
        ▼
Feedback stored  ─── used later to retrain and improve the model
```

Every step except the last two happens automatically in seconds. The doctor sees only the ranked segments — not 1 hour of raw EEG. That's the triage assistant.

Inference is the moment the system actually helps a doctor. Without it, the model is just a file sitting on a hard drive.

---

*Updated: June 2026*
