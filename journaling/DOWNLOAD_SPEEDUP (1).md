# Download Speedup Guide — CHB-MIT EEG Project

Use this file in Cursor / OpenCode as context when working on `preprocess.ipynb` or `eeg.ipynb`.

---

## Pipeline reminder (don't mix this up)

```
PhysioNet  →  Colab download  →  Google Drive (raw .edf)
Google Drive  →  Colab preprocess  →  Google Drive (processed/*.npy)
Google Drive processed/  →  upload once  →  Kaggle Dataset
Kaggle Dataset  →  train.ipynb  →  train model
```

**Kaggle never needs the 55 GB raw files.** Only upload `processed/` (~2–5 GB).

---

## What's slowing downloads down

| Problem | Where | Effect |
|---------|-------|--------|
| Downloads `.edf.seizures` files | Cell 2, `dl_one()` | ~2× HTTP requests; files are **never read** |
| Only 6 parallel workers | Cell 2, `ThreadPoolExecutor(max_workers=6)` | Underuses Colab network |
| `wget` per small file | Cell 2 | Slow vs bulk S3 sync |
| Writing thousands of files to Drive | Cell 2 | Drive I/O is often the bottleneck |

**Labels come from `chbXX-summary.txt` only** (Cell 3). The `.seizures` sidecars are unused.

---

## Speed fixes (pick one method)

### Method A — Quick patch (5 min, keep wget)

Edit **Cell 2** in `preprocess.ipynb`. Three changes:

1. **Delete** the `.seizures` download block inside `dl_one`
2. Change `max_workers=6` → `max_workers=12`
3. Change the print line to say `[12 parallel]`

**Replace `dl_one` with this:**

```python
def dl_one(args):
    fn, epath, ub = args
    nw = False
    if not os.path.exists(epath):
        subprocess.run(["wget", "-q", "-O", epath, ub + fn],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        nw = True
    sz = os.path.getsize(epath) / (1024 * 1024)
    return fn, sz, nw
```

**Replace the executor line:**

```python
with ThreadPoolExecutor(max_workers=12) as pool:  # was 6
```

**Optional:** delete existing sidecars on Drive to free space (not needed for the pipeline):

```python
!find /content/drive/MyDrive/EEG_PROJECT -name "*.edf.seizures" -delete
```

---

### Method B — AWS S3 sync (fastest, recommended for all 24 patients)

PhysioNet hosts CHB-MIT on public S3. This is **official** and much faster than hundreds of `wget` calls.

**Add a new cell** (or replace Cell 2) in Colab — run after `drive.mount` and `BASE_DIR` is set:

```python
# Cell 2 (S3): Bulk download from PhysioNet AWS mirror
!pip install -q awscli

BASE_DIR = "/content/drive/MyDrive/EEG_PROJECT"
os.makedirs(BASE_DIR, exist_ok=True)

# Tune parallelism (optional, helps on Colab)
!mkdir -p ~/.aws
with open(os.path.expanduser("~/.aws/config"), "w") as f:
    f.write("""[default]
s3 =
    max_concurrent_requests = 20
    multipart_threshold = 64MB
    multipart_chunksize = 16MB
""")

# --- OPTION 1: All 24 patients (one shot, ~42 GB) ---
# !aws s3 sync --no-sign-request s3://physionet-open/chbmit/1.0.0/ {BASE_DIR}/

# --- OPTION 2: Only patients you need (recommended) ---
PATIENT_RANGE = range(1, 12)   # chb01–chb11 | use range(1, 25) for all 24
# PATIENT_RANGE = range(12, 18)  # run in batches if Colab times out

for i in PATIENT_RANGE:
    pid = f"chb{i:02d}"
    print(f"\n=== Syncing {pid} ===")
    !aws s3 sync --no-sign-request \
        s3://physionet-open/chbmit/1.0.0/{pid}/ \
        {BASE_DIR}/{pid}/

    # Summary file lives at dataset root on S3
    summary_dst = f"{BASE_DIR}/{pid}-summary.txt"
    if not os.path.exists(summary_dst):
        !aws s3 cp --no-sign-request \
            s3://physionet-open/chbmit/1.0.0/{pid}/{pid}-summary.txt \
            {summary_dst}

print("\n===== S3 SYNC DONE =====")
```

**Notes:**
- `sync` skips files already on Drive — safe to re-run after timeout
- S3 may still download `.seizures` files into patient folders; they are harmless but unused. Delete them with the `find ... -delete` command above if you want space back
- You do **not** need Method A if you use Method B

---

### Method C — Single ZIP (simple, one big download)

PhysioNet offers one ~42.6 GB ZIP. Good for overnight download.

```python
BASE_DIR = "/content/drive/MyDrive/EEG_PROJECT"
ZIP_PATH = "/content/chbmit.zip"

# -c resumes if interrupted
!wget -c -O {ZIP_PATH} https://physionet.org/static/published-projects/chbmit/chb-mit-scalp-eeg-database-1.0.0.zip

!unzip -q {ZIP_PATH} -d {BASE_DIR}
# ZIP unpacks into chbmit/1.0.0/ — move folders to match BASE_DIR layout if needed
```

Slower to start than S3 sync, but only one HTTP connection to manage.

---

## Download in batches (avoid Colab timeouts)

You don't need all 24 patients now. Current pipeline uses **11 patients**.

| Session | Code | Patients |
|---------|------|----------|
| Now | `range(1, 12)` | chb01–chb11 |
| Later | `range(12, 18)` | chb12–chb17 |
| Later | `range(18, 25)` | chb18–chb24 |

Change `for i in range(1, 12):` in Cell 2, or `PATIENT_RANGE` in the S3 cell.

Re-running always skips files that already exist.

---

## Full patched wget Cell 2 (copy-paste replacement)

Use this if you want the full cell fixed in one go (no `.seizures`, 12 workers, configurable range):

```python
start_time = time.time()
total_bytes = 0

PATIENT_RANGE = range(1, 12)   # change to range(1, 25) for all 24
MAX_WORKERS = 12               # was 6; drop to 8 if PhysioNet throttles

for i in PATIENT_RANGE:
    pid = f"chb{i:02d}"
    pdir = os.path.join(BASE_DIR, pid)
    os.makedirs(pdir, exist_ok=True)

    summary_url = f"https://physionet.org/files/chbmit/1.0.0/{pid}/{pid}-summary.txt"
    summary_path = os.path.join(BASE_DIR, f"{pid}-summary.txt")
    if not os.path.exists(summary_path):
        subprocess.run(["wget", "-q", "-O", summary_path, summary_url])
    total_bytes += os.path.getsize(summary_path)

    records_url = f"https://physionet.org/files/chbmit/1.0.0/{pid}/RECORDS"
    records_path = os.path.join(pdir, "RECORDS")
    subprocess.run(["wget", "-q", "-O", records_path, records_url])

    edf_list = []
    try:
        with open(records_path, "r") as f:
            edf_list = [l.strip() for l in f.read().splitlines() if l.strip().endswith(".edf")]
    except:
        pass

    source = "RECORDS"
    if len(edf_list) < 5:
        try:
            with open(summary_path, "r") as f:
                content = f.read()
            edf_list = re.findall(r"File Name:\s*(\S+\.edf)", content)
            source = "summary"
        except:
            pass

    base_url = f"https://physionet.org/files/chbmit/1.0.0/{pid}/"
    tasks = [(f.strip(), os.path.join(pdir, f.strip()), base_url) for f in edf_list if f.strip()]

    print(f"\n{pid}: {len(tasks)} files ({source}) [{MAX_WORKERS} parallel, .edf only]")

    def dl_one(args):
        fn, epath, ub = args
        nw = False
        if not os.path.exists(epath):
            subprocess.run(["wget", "-q", "-O", epath, ub + fn],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            nw = True
        sz = os.path.getsize(epath) / (1024 * 1024)
        return fn, sz, nw

    done = 0; nc = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(dl_one, t) for t in tasks]
        for f in as_completed(futures):
            fn, sz, is_new = f.result()
            done += 1
            m = " NEW" if is_new else ""
            if is_new: nc += 1
            print(f"  [{done}/{len(tasks)}] {fn} ({sz:.0f} MB){m}")

    elapsed = time.time() - start_time
    pbytes = sum(os.path.getsize(os.path.join(pdir, f)) for f in edf_list if os.path.exists(os.path.join(pdir, f)))
    total_bytes += pbytes
    print(f"  {nc} new, {done-nc} existed | Total: {total_bytes/1e9:.1f} GB | {elapsed/60:.0f} min")

print(f"\n===== DONE ({total_bytes/1e9:.2f} GB in {(time.time()-start_time)/60:.0f} min) =====")
```

---

## Rough time expectations

| Method | 11 patients | All 24 |
|--------|---------------|--------|
| Old (wget + `.seizures` + 6 workers) | 2–4+ hrs | 6–12+ hrs |
| Patched wget (no `.seizures`, 12 workers) | ~1–2 hrs | 3–6 hrs |
| AWS S3 sync | ~30–90 min | 1–3 hrs |
| Single ZIP | ~1–2 hrs + unzip | same |

Times vary with Colab network and Drive speed.

---

## What to do after download

1. Run preprocess Cells 3–12 → saves `processed/*.npy` to Drive
2. Upload `processed/` folder to Kaggle Dataset (not raw `.edf`)
3. Run `train.ipynb` on Kaggle with that dataset attached

---

## Recommendation

| Situation | Use |
|-----------|-----|
| Already half-downloaded with old Cell 2 | **Method A** (patch wget) — re-run skips existing files |
| Starting fresh or want all 24 | **Method B** (S3 sync) |
| Colab keeps timing out | **Batches** + any method above |
| Want simplest mental model | **Method C** (ZIP overnight) |

**Do not** move 55 GB raw data to Kaggle. **Do** upload only `processed/` after preprocessing.
