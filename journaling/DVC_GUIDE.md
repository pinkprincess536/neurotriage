# DVC Setup Guide — Data Versioning for EEG Project

## TL;DR

DVC tracks your `.npy` files like Git tracks code. When you add chb12, DVC knows the dataset changed, saves the old version, and lets you compare: "v1 (11 patients) → recall 0.83 vs v2 (14 patients) → recall 0.78."

---

## The 5-Minute Mental Model

```
Git:       Who changed main.py?        → git log main.py
DVC:       Who changed X_train.npy?     → dvc log X_train.npy.dvc

Together:  Code v5 + Data v3 → Model → recall 0.83
```

Files are stored on your Google Drive (free 5 TB). DVC just tracks metadata.

---

## Step 1: Initialize DVC (One Time, Colab)

Run this cell in Colab before preprocessing:

```python
!pip install dvc[gdrive]

# DVC needs to know where it lives
%cd /content/drive/MyDrive/EEG_PROJECT

# Initialize (creates .dvc/ folder)
!dvc init

# Tell Git to track DVC metadata files
!git init   # if not already a git repo
!git add .dvc .gitignore
!git commit -m "init dvc"
```

**What happened:** A `.dvc/` folder was created. This is DVC's brain — it stores hashes of your data files. Tiny text files, not the data itself.

---

## Step 2: Add Google Drive as Storage (One Time)

```python
# Google Drive IS your remote storage
!dvc remote add -d myremote gdrive://MyDrive/EEG_PROJECT/.dvc/cache

# Test the connection
!dvc remote list
```

**What happened:** DVC now knows "when I push data, send it to this Google Drive folder." The data itself stays on your 5 TB Drive.

---

## Step 3: Track .npy Files (Every Time You Preprocess)

After Cells 11 (normalize) and 12 (save .npy) complete:

```python
%cd /content/drive/MyDrive/EEG_PROJECT

# Tell DVC to track these files
!dvc add processed/X_train.npy processed/y_train.npy processed/X_test.npy processed/y_test.npy

# Commit the metadata to git
!git add processed/.gitignore processed/*.dvc
!git commit -m "dataset: 11 patients, recall 0.83 (5x penalty)"

# Push data to Google Drive remote
!dvc push
```

**What happened:** DVC hashed each `.npy` file and stored the hash in `.dvc` metadata. The actual `.npy` files were copied to the DVC cache. Now `git log` shows the dataset version.

---

## Step 4: Pull Data on Kaggle (Every Session)

In your Kaggle notebook, before loading data:

```python
!pip install dvc[gdrive]

# Clone your repo (has the .dvc metadata files)
!git clone https://github.com/pinkprincess536/eeg.git /kaggle/working/repo
%cd /kaggle/working/repo

# Point DVC to the same Google Drive storage
!dvc remote add -d myremote gdrive://MyDrive/EEG_PROJECT/.dvc/cache

# Pull the latest dataset
!dvc pull

# Now load the data
X_train = np.load("processed/X_train.npy")
```

**What happened:** DVC compares local hashes vs Google Drive. If data was updated (more patients), it downloads the new version. If not, nothing happens. Instant.

---

## Step 5: Compare Versions

```python
# See all dataset versions
!git log --oneline -- processed/X_train.npy.dvc

# Compare two versions
!dvc diff HEAD~1 HEAD
# Output: "X_train.npy: file changed (1.2M → 1.8M)"
```

**What happened:** You can now answer: "Why did recall drop from 0.83 to 0.78?" → check `dvc diff` → "ah, chb12 added 50 seizure windows from a very noisy recording"

---

## The Full Workflow (After Setup)

```
MONDAY:
  1. Colab: download chb12, chb13, chb14
  2. Colab: preprocess (re-run cells 9-12)
  3. Colab: dvc add → dvc push   ← data v2 is live

TUESDAY:
  4. Kaggle: dvc pull → data auto-updated → retrain
  5. Compare: v1 recall 0.83 vs v2 recall 0.78
  6. Investigate: chb12 data quality issue found
```

---

## Common Questions

**Q: Is this safe? Can I lose data?**
A: DVC never deletes data. Old versions stay in the cache forever. `dvc checkout v1` restores them.

**Q: What if Google Drive is full?**
A: You have 5 TB. Processed `.npy` files are ~500 MB per version. You'd need 10,000 versions to fill it.

**Q: Can I do this without Git?**
A: Technically yes, but pointless. DVC + Git together = reproducible ML. Alone = just file hashing.

**Q: Does this work with Kaggle Datasets too?**
A: Yes. Use `dvc pull` once to get the latest, then upload as Kaggle Dataset. Or use DVC directly on Kaggle with Google Drive OAuth.
