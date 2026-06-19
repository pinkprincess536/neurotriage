# Platforms for Training EEG Seizure Detection Model
## CHB-MIT Full Dataset (24 Patients, ~55 GB)

---

### Quick Recommendation

```
Download 55 GB    -> Colab (free, Drive native)
Preprocess data   -> Colab (free, CPU sufficient)
Train 1D CNN      -> Kaggle (free, 9 hrs batch)
                  -> Colab (free, 6-12 hrs)
                  -> RunPod ($5 credit covers ~10 hrs)
```

---

## Platform Comparison

### 1. Google Colab (Free)

| Category | Detail |
|---|---|
| GPU | T4 (16 GB VRAM) -- more than enough for your 1D CNN |
| RAM | ~12 GB -- tight for 24 patients, fine with reservoir sampling |
| Max runtime | 6-12 hours (varies; kills on idle or when tab closed) |
| Weekly limit | Unpublished, resets daily. "No GPU available" if overused |
| Drive integration | Native `drive.mount()` -- your 5 TB Drive always available |
| Background execution | ❌ Dies when you close the tab |
| Notebook format | `.ipynb` (native) |
| Internet | `wget`, `pip`, `apt-get` all work freely |
| **Cost** | **$0** |
| **Best for** | **Download + Preprocessing.** Training only if it finishes within ~6 hrs |

---

### 2. Kaggle Notebooks (Free)

| Category | Detail |
|---|---|
| GPU | T4 or P100 (16 GB VRAM) |
| RAM | ~13 GB |
| Max runtime | **9 hours batch** (Save & Run, close laptop -- keeps running) |
| Session type | **Interactive** (~6 hrs) or **Batch** (~9 hrs) |
| Weekly limit | **30 hours/week GPU** (resets Monday) |
| Drive integration | ❌ No native mount. Upload data as Kaggle Dataset or download via `wget` |
| Internet | Requires **phone verification** for `wget`/curl |
| Background execution | ✅ Runs when tab closed (batch mode) |
| Notebook format | `.ipynb` (identical to Colab) |
| Persistent storage | Kaggle Datasets (upload once, attach to any notebook) |
| **Cost** | **$0** |
| **Best for** | **Training.** 9 uninterrupted hours > Colab. 30 hrs/week is plenty |

**Kaggle-specific notes:**
- Can access Google Drive via `google-drive-ocamlfuse` (requires setup)
- Kaggle Datasets persist across sessions; upload processed `.npy` files once
- Same `.ipynb` format as Colab -- just copy-paste cells

---

### 3. RunPod (Pay-Per-Second)

| Category | Detail |
|---|---|
| GPU options | RTX 3090 ($0.44/hr), A40 ($0.79/hr), A100 ($1.99/hr), H100 ($2.99/hr) |
| RAM | 25-188 GB depending on GPU |
| Max runtime | Unlimited (you pay for it) |
| Storage | Volume: $0.10/GB/mo (running), $0.20/GB/mo (idle). Network: $0.05-0.07/GB/mo |
| New user bonus | **$5-$500 random credit** on first $10 spend |
| Setup | Manual -- configure environment via SSH or Jupyter |
| Background | ✅ Runs indefinitely |
| Notebook support | Jupyter (`.ipynb`) via web terminal or port forwarding |
| Google Drive | Manual setup via `rclone` or download data to volume |
| **Cost** | Free: $5 credit covers ~10 hrs. Paid: ~$5-20 for one full training run |
| **Best for** | **Safety net.** If free platforms can't finish training, this is the cheapest paid option |

---

### 4. Paperspace Gradient (Freemium)

| Category | Detail |
|---|---|
| Free GPU | Basic instances only (weak, queue-based -- often unavailable) |
| Pro GPU | $8/mo subscription + $1.10/hr for P6000 class GPUs |
| Free tier RAM | Limited |
| Free tier runtime | ~6 hours |
| Free tier storage | 5 GB |
| Pro storage | 15 GB ($8/mo), $0.29/GB overage |
| Drive integration | ❌ No Google Drive mount |
| Notebook format | `.ipynb` supported |
| **Cost** | Free tier: $0 (weak). Pro: $8/mo + $1.10/hr GPU |
| **Best for** | Not recommended for this project. Free tier is too limited. Pro costs add up quickly. |

---

### 5. AWS SageMaker Studio Lab (Free)

| Category | Detail |
|---|---|
| GPU | T4 (16 GB VRAM) |
| RAM | 15 GB |
| Max runtime | 4 hours/session |
| Session limit | Auto-terminates at 4 hours (shorter than Colab) |
| Storage | 15 GB persistent |
| Drive integration | ❌ No Google Drive mount |
| Notebook format | `.ipynb` supported |
| Waitlist | May require signing up, wait times vary |
| **Cost** | **$0** |
| **Best for** | Backup option. Worse runtime than Colab. Only if other platforms are unavailable. |

---

### 6. Lightning AI (Free Tier)

| Category | Detail |
|---|---|
| GPU | T4 (16 GB VRAM) |
| RAM | Variable (~12-16 GB) |
| Max runtime | ~4 hours |
| Storage | Limited free tier |
| Drive integration | ❌ |
| Notebook format | `.ipynb` supported |
| **Cost** | **$0** |
| **Best for** | Light experimentation only. Not suitable for full 24-patient training. |

---

## Project Completion Strategy

### Phase 1: Download (1-3 hours, one time)
```
Platform:  Colab (CPU runtime)
Storage:   Your 5 TB Google Drive
Task:      Download 55 GB of .edf files for all 24 patients
Fallback:  Re-run if timeout -- files already downloaded are skipped
```

### Phase 2: Preprocessing (30-60 min, one time)
```
Platform:  Colab (CPU runtime)
Task:      Filter + window all 24 patients
Output:    Save X_train_1d.npy, y_train_1d.npy, etc. to Drive
Fallback:  Re-run from partial progress
```

### Phase 3: Training (2-8 hours, repeated)
```
PRIMARY:   Kaggle Notebooks
           - 9 hrs batch mode (close laptop, it keeps running)
           - 30 hrs/week free GPU
           - Upload .npy files as Kaggle Dataset (one time)
           
BACKUP:    Colab (GPU)
           - 6-12 hrs runtime
           - Direct Drive access (no data upload needed)
           - Risk: timeout mid-training
           
FALLBACK:  RunPod RTX 3090
           - $0.44/hr (~$3-5 per full training run)
           - $5 free credit covers first few experiments
           - Unlimited runtime
```

### Phase 4: Iterative Experimentation (ongoing)
```
Platform:  Kaggle (primary) or Colab (backup)
Task:      Tweak hyperparameters, try different architectures
           Compare results, improve sensitivity/specificity
Cost:      $0 (free tier on either platform)
```

---

## Key Numbers

| Metric | Value |
|---|---|
| Total dataset size (raw .edf) | ~55 GB |
| Processed training data (.npy) | ~2-5 GB |
| Model size (EEGCNN1D) | ~300K params, ~1.2 MB |
| VRAM needed per batch | ~100 MB (Colab/Kaggle have 16,000 MB) |
| Training time estimate (24 pts) | 2-8 hours (depends on epochs) |
| GPU hours needed per experiment | ~5 hours |
| Kaggle weekly free GPU | 30 hours (covers 6 experiments/week) |

---

## Summary

| Priority | Platform | Why |
|---|---|---|
| **1st** | Kaggle Notebooks | 9 hrs batch, 30 hrs/week, free, same .ipynb |
| **2nd** | Google Colab | Native Drive, free, convenient for download/preprocess |
| **3rd** | RunPod | $5 credit covers fallback, $0.44/hr for RTX 3090 |
| **Skip** | Paperspace, SageMaker, Lightning | Worse limits than Colab/Kaggle for this use case |
