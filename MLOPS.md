# MLOps Learnings

This document captures the core MLOps concepts behind each change we make to this project.

---

## Step 1: Model Evaluation Metrics & Versioned Model Management

### What is MLOps?

MLOps = Machine Learning + DevOps. It's the practice of applying DevOps principles (automation, versioning, CI/CD, monitoring) to machine learning systems.

A traditional software app is: **code → build → deploy → monitor**.
An ML system is: **data + code + model → train → evaluate → deploy → monitor → retrain**.

The extra complexity comes from the fact that ML systems have **three things that can change** (data, code, and model), not just one (code). MLOps gives you tools and practices to manage all three.

### The ML Lifecycle

```
┌─────────┐     ┌──────────┐     ┌────────┐     ┌─────────┐     ┌───────────┐
│  Train   │ ──→ │ Evaluate │ ──→ │ Deploy │ ──→ │ Monitor │ ──→ │ Retrain   │
└─────────┘     └──────────┘     └────────┘     └─────────┘     └───────────┘
     ↑                                                                │
     └────────────────────────────────────────────────────────────────┘
```

1. **Train** — Feed data into a model architecture, optimize weights
2. **Evaluate** — Measure how well the model performs using metrics
3. **Deploy** — Put the model into production where users interact with it
4. **Monitor** — Watch how the model performs on real-world data
5. **Retrain** — When performance degrades or new data arrives, train again

Our project implements this full loop:
- **Train**: Original model trained in `train_eeg.ipynb` on CHB-MIT dataset
- **Evaluate**: `compute_metrics()` in `retrain.py` computes accuracy, recall, precision, etc.
- **Deploy**: FastAPI backend serves predictions via `/patients/{id}/upload`
- **Monitor**: Doctors provide feedback (correct/incorrect) on model predictions
- **Retrain**: Admin triggers `/retrain`, model learns from doctor feedback

### Model Versioning — Why It Matters

Imagine you retrain your model and it performs worse than before. Without versioning, your old model is gone. With versioning, you can **roll back** instantly.

**What we built:**
- Each model version is saved as `eegcnn1d_weights_v1.pth`, `v2.pth`, etc.
- `model_config.json` tracks all versions, their metrics, and which one is active
- Admin can activate any version — the doctor always uses whichever version the admin chose
- New retrained models are **not activated automatically** — admin reviews metrics first

**Why this matters:**
- **Reproducibility** — You can always recreate the exact model that produced a given prediction
- **Rollback** — Bad retrain? Switch back to the previous version in one click
- **A/B comparison** — Compare metrics between v1 and v2 before deciding which to deploy
- **Audit trail** — Know exactly which model version was used for each patient's results

This is analogous to git for code — you'd never deploy code without version control, and you shouldn't deploy models without it either.

### Evaluation Metrics — The Confusion Matrix

Every prediction falls into one of four categories. For seizure detection:

```
                        Predicted
                   Seizure    Normal
                ┌──────────┬──────────┐
Actual Seizure  │    TP    │    FN    │
                ├──────────┼──────────┤
Actual Normal   │    FP    │    TN    │
                └──────────┴──────────┘
```

- **TP (True Positive)** — Model said "seizure" and it WAS a seizure. Correct.
- **FP (False Positive)** — Model said "seizure" but it was normal. False alarm.
- **TN (True Negative)** — Model said "normal" and it WAS normal. Correct.
- **FN (False Negative)** — Model said "normal" but it was a seizure. **Missed seizure.**

### The Five Metrics

**1. Accuracy** = (TP + TN) / (TP + FP + TN + FN)

"Of all predictions, how many were correct?"

Sounds great, but it's **misleading with imbalanced data**. If 95% of EEG windows are normal, a model that always says "normal" gets 95% accuracy — but catches zero seizures. Useless.

**2. Recall (Sensitivity)** = TP / (TP + FN)

"Of all actual seizures, how many did we catch?"

This is the **most important metric for medical ML**. A recall of 0.59 means we catch 59% of seizures and miss 41%. Every missed seizure (FN) is a patient who doesn't get treated.

**3. Precision** = TP / (TP + FP)

"Of all windows we flagged as seizure, how many actually were?"

Low precision means lots of false alarms. Doctors waste time reviewing normal windows. Annoying but not dangerous.

**4. Specificity** = TN / (TN + FP)

"Of all normal windows, how many did we correctly ignore?"

High specificity means few false alarms. A specificity of 0.95 means only 5% of normal windows get incorrectly flagged.

**5. F1 Score** = 2 * (Precision * Recall) / (Precision + Recall)

The harmonic mean of precision and recall. It balances both — useful when you care about both catching seizures AND not flooding doctors with false alarms.

### Why Recall > Accuracy for Seizure Detection

In medical ML, the **cost of errors is asymmetric**:

| Error Type | What Happens | Severity |
|---|---|---|
| False Negative (missed seizure) | Patient doesn't get treatment | **Dangerous** |
| False Positive (false alarm) | Doctor reviews a normal window | Annoying but safe |

Missing a seizure can lead to injury or death. A false alarm just wastes a few seconds of a doctor's time.

That's why we optimize for **recall first** — catch as many real seizures as possible, even if it means some false alarms. Then we tune precision/specificity to reduce the noise.

Our original model (v1):
- Recall: 59% — catches about 6 out of 10 seizures
- Specificity: 95.3% — correctly ignores most normal windows
- There's room to improve recall through retraining on doctor feedback

### Training Metrics vs Test Metrics

When we retrain on doctor feedback and then evaluate on that **same feedback data**, the numbers look optimistic. The model has already "seen" these examples during training, so it naturally scores higher.

This is like studying the answer key and then taking the test — you'll ace it, but it doesn't prove you understand the material.

**What our metrics mean right now:**
- v1 metrics → evaluated on a **held-out test set** (real, honest numbers)
- v2+ metrics → evaluated on **training data** (optimistic, marked as "Training metrics" in the UI)

As feedback data grows (50+ samples), we can hold out 20% for honest evaluation. For now, training metrics still show whether the model learned anything from the feedback — if accuracy is low even on training data, something is wrong.

### What We Implemented (Code ↔ Concepts)

| Concept | Implementation |
|---|---|
| ML Lifecycle | Full loop: train → evaluate → deploy → monitor (feedback) → retrain |
| Model Versioning | `model_config.json` with versions array, versioned weight files |
| Confusion Matrix | `compute_metrics()` in `retrain.py` computes TP, FP, TN, FN |
| Evaluation Metrics | accuracy, recall, precision, specificity, F1 saved per version |
| Admin Model Control | `GET /models` lists versions + metrics, `POST /models/activate` switches |
| Role-based Access | Doctor sees patients/upload, Admin sees model dashboard + retrain |
| Safe Deployment | Retrained model saved but NOT activated until admin reviews metrics |

### Files Changed

| File | What Changed |
|---|---|
| `retrain.py` | Added `compute_metrics()`, metrics saved per version, v1 gets original test metrics |
| `App.jsx` | Split into doctor view (upload flow) and admin view (model dashboard) |
| `App.css` | Metrics table styling, scrollable for wide tables |
| `backend.py` | No changes — `GET /models` already returns version data with metrics |

---

## Step 2: Containerization with Docker

### What is Containerization?

Containerization = packaging your application with **everything it needs to run** (OS, Python, libraries, model files) into a single portable unit called a **container**.

Without containers:
```
"It works on my machine" → crashes on the server
Different Python version, missing library, wrong OS, path differences...
```

With containers:
```
"It works in the container" → works everywhere
Same environment on your laptop, your teammate's laptop, the production server
```

### Docker Concepts

**Dockerfile** — A recipe (text file) that describes how to build your environment step by step:

```
FROM python:3.10-slim     ← Start with Python 3.10 pre-installed
COPY requirements.txt .   ← Copy your dependency list
RUN pip install ...        ← Install dependencies
COPY backend.py .          ← Copy your code
CMD uvicorn backend:app    ← "When someone runs this container, start the server"
```

Each line creates a **layer**. Docker caches layers — if you change your code but not your dependencies, Docker only re-runs the code copy step, not the pip install step. This makes rebuilds fast.

**Image** — The built result of a Dockerfile. A frozen snapshot of the entire environment. Read-only. Think of it as a **template**.

**Container** — A running instance of an image. You can run 10 containers from 1 image. Think of it as a **running copy** of the template.

```
Dockerfile (recipe) ──build──→ Image (template) ──run──→ Container (running app)
```

**Registry** — A place to store and share images. Docker Hub is the most common (like GitHub but for Docker images). You `push` images to a registry and `pull` them to run elsewhere.

### Multi-Stage Builds

Our frontend uses a **multi-stage build** — two separate stages in one Dockerfile:

**Stage 1: Build**
- Uses Node.js (300MB) to compile React → static HTML/CSS/JS files (~500KB)
- This stage exists only to produce the build output

**Stage 2: Serve**
- Uses Nginx (25MB) to serve the static files
- Copies ONLY the build output from Stage 1
- Node.js is thrown away — it's not in the final image

```
Stage 1 (builder):  Node.js + source code → npm run build → dist/ folder
                                                    ↓ (copy only dist/)
Stage 2 (final):    Nginx + dist/ folder → serve static files
```

Result: **25MB final image** instead of 300MB. The build tools (Node, npm, source code) are not in the production image.

Analogy: You need an oven to bake a cake, but you don't ship the oven to the customer — just the cake.

### Docker Compose

When your app has multiple services (backend + frontend), Docker Compose lets you define and run them together:

```yaml
services:
  backend:
    build: .            # Build from Dockerfile in root
    ports: ["8000:8000"] # Map container port 8000 to host port 8000
    env_file: .env       # Load environment variables

  frontend:
    build: ./eeg-triage  # Build from Dockerfile in eeg-triage/
    ports: ["80:80"]
    depends_on: [backend] # Start backend before frontend
```

One command to rule them all:
- `docker compose up` — build and start everything
- `docker compose down` — stop everything
- `docker compose up --build` — rebuild and start

### .dockerignore — Keeping Images Lean and Secure

Just like `.gitignore` tells git which files to skip, `.dockerignore` tells Docker which files to NOT copy into the image:

```
.git/           ← Could be 100MB+, not needed at runtime
.env            ← NEVER bake secrets into an image
node_modules/   ← Will be installed fresh inside the container
*.ipynb         ← Notebooks aren't needed for the server
journaling/     ← Documentation doesn't need to be in the image
```

**Security note:** If `.env` is copied into the image, anyone who gets the image gets your passwords and API keys. By excluding it and using `env_file:` in docker-compose, secrets are passed at **runtime**, not baked into the image.

### CPU-Only PyTorch — Why We Skip GPU Support

PyTorch ships with CUDA (GPU) support by default. This adds **~1.8GB** to the download.

Our model is tiny (300K parameters, 0.66MB weights file). It runs inference in milliseconds on CPU. We don't need GPU support in the Docker image.

By installing with `--index-url https://download.pytorch.org/whl/cpu`, we get CPU-only PyTorch at **~200MB** — a 10x size reduction with identical performance for our use case.

| Version | Size | When to use |
|---|---|---|
| PyTorch + CUDA | ~2GB | Training large models on GPU servers |
| PyTorch CPU-only | ~200MB | Inference with small models, Docker images, CI/CD |

### What We Implemented (Code ↔ Concepts)

| Concept | Implementation |
|---|---|
| Backend container | `Dockerfile` — Python 3.10 slim, CPU-only PyTorch, copies model + source |
| Frontend container | `eeg-triage/Dockerfile` — Multi-stage: Node build → Nginx serve |
| SPA routing | `eeg-triage/nginx.conf` — Falls back to index.html for React Router |
| Service orchestration | `docker-compose.yml` — Backend + frontend, env_file, health check |
| Image optimization | `.dockerignore` — Excludes .git, .env, notebooks, node_modules |
| Secret management | `.env.example` template + `env_file:` at runtime (not baked in) |
| Build arg | `VITE_BACKEND_URL` passed at build time for frontend API URL |

### Files Created

| File | What it does |
|---|---|
| `Dockerfile` | Backend container recipe — Python + FastAPI + model |
| `eeg-triage/Dockerfile` | Frontend container recipe — Node build → Nginx serve |
| `eeg-triage/nginx.conf` | Nginx config for SPA routing + static file caching |
| `docker-compose.yml` | Runs backend + frontend together |
| `.dockerignore` | Excludes unnecessary files from backend image |
| `eeg-triage/.dockerignore` | Excludes node_modules/dist from frontend build context |
| `.env.example` | Template showing required environment variables |

---

## Step 3: Automated Testing with pytest

### Why Automated Tests?

You change one line in `retrain.py`. It works. You push to main. But that change accidentally broke the `/login` endpoint — and you don't notice until a user complains.

Automated tests prevent this. Before every deploy, you run a suite of tests that verify: "Can users still log in? Does the model load? Do admin-only endpoints reject doctors?"

**Without tests:**
```
Change code → Push → Hope nothing broke → Find out from users
```

**With tests:**
```
Change code → Run tests → Tests catch the bug → Fix before pushing
```

### pytest — The Standard Python Test Framework

pytest discovers and runs test functions automatically. The rules are simple:
- Files named `test_*.py` are test files
- Functions named `test_*` are test functions
- Use `assert` to check expected values

```python
def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200         # Did it return OK?
    assert res.json()["status"] == "ok"   # Is the response correct?
```

If any `assert` fails, the test fails and pytest tells you exactly which line and what the values were.

### Fixtures — Reusable Test Setup

A **fixture** is a function that provides something tests need (a database connection, a test client, a logged-in user). pytest injects fixtures automatically by matching parameter names:

```python
@pytest.fixture()
def admin_token(client):
    res = client.post("/login", json={"password": "test-admin"})
    return res.json()["token"]

def test_models_admin(client, admin_token):
    # pytest sees "admin_token" parameter → calls the fixture → passes the result
    res = client.get("/models", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
```

**`scope="session"`** means the fixture runs once for the entire test session (not once per test). We use this for the test client since loading the ML model is slow — we only want to do it once.

### Mocking — Faking External Services

Our backend needs Supabase (cloud database). But in tests, we don't want to:
- Require a real Supabase account to run tests
- Write test data to the production database
- Have tests fail because the internet is down

**Mocking** = replacing a real object with a fake one that behaves how we tell it to.

```python
mock_supabase = MagicMock()  # Fake Supabase client
mock_supabase.table("feedback").insert(...).execute()  # Won't actually call Supabase

with patch("backend.create_client", return_value=mock_supabase):
    # Now when backend.py calls create_client(), it gets our fake instead
```

The backend thinks it's talking to Supabase, but it's actually talking to our mock. The mock accepts any method call and returns fake data — so the code runs without errors, and we can test the logic without the external dependency.

### What We Test

| Test | What it verifies |
|---|---|
| `test_health` | Server is running, model is loaded |
| `test_login_doctor` | Doctor password → returns doctor role + token |
| `test_login_admin` | Admin password → returns admin role + token |
| `test_login_wrong_password` | Wrong password → 401 Unauthorized |
| `test_models_admin` | Admin can list model versions |
| `test_models_doctor_forbidden` | Doctor cannot list models → 403 |
| `test_models_no_auth` | No token → 403 |
| `test_activate_admin` | Admin can activate a model version |
| `test_activate_invalid_version` | Invalid version → 400 |
| `test_activate_doctor_forbidden` | Doctor cannot activate → 403 |
| `test_feedback` | Feedback saves successfully (mocked Supabase) |
| `test_retrain_doctor_forbidden` | Doctor cannot retrain → 403 |
| `test_retrain_no_auth` | No token → 403 |

### How Tests Connect to CI/CD

In the next step (GitHub Actions), we'll run `pytest` automatically on every push:

```
Developer pushes code → GitHub Actions runs pytest → 
  If tests pass → proceed to build + deploy
  If tests fail → STOP, notify developer
```

Tests are the **gate** that prevents broken code from reaching production.

### What We Implemented (Code ↔ Concepts)

| Concept | Implementation |
|---|---|
| Test framework | pytest with `pyproject.toml` config |
| Test client | FastAPI's `TestClient` — sends real HTTP requests to the app in-process |
| Fixtures | `client` (session-scoped), `admin_token`, `doctor_token` |
| Mocking | `MagicMock` replaces Supabase client, `patch` injects it |
| Auth testing | Tests verify admin-only endpoints reject doctor tokens |
| Python path | `pythonpath = ["."]` in pyproject.toml so tests can import `backend` |

### Files Created

| File | What it does |
|---|---|
| `tests/conftest.py` | Fixtures: mock Supabase, create TestClient, generate auth tokens |
| `tests/test_api.py` | 13 endpoint tests covering auth, models, feedback, retrain |
| `requirements-dev.txt` | Test dependencies (pytest, httpx) — not in production image |
| `pyproject.toml` | pytest config: test paths, Python path |

---

## Step 4: CI/CD with GitHub Actions

### What is CI/CD?

**CI (Continuous Integration)** = automatically testing code every time someone pushes. The word "integration" means you're constantly checking that new code "integrates" with existing code without breaking it.

**CD (Continuous Deployment)** = automatically deploying code after tests pass. No human clicks "deploy" — the pipeline does it.

Together, CI/CD creates an automated quality gate:

```
Push code → Tests run automatically → Pass? → Build + Deploy
                                    → Fail? → STOP, notify developer
```

Without CI/CD: "I'll run the tests later... oops I forgot, now production is broken."
With CI/CD: Tests run whether you remember or not. Broken code can't slip through.

### GitHub Actions — How It Works

GitHub Actions is GitHub's built-in CI/CD platform. You define **workflows** in YAML files inside `.github/workflows/`.

**Key concepts:**

**Workflow** — A YAML file that defines what to automate. Triggered by events (push, pull request, schedule).

**Job** — A set of steps that run on a fresh virtual machine. Multiple jobs can run in parallel or sequentially.

**Step** — A single command or action within a job. Steps run sequentially within a job.

**Runner** — The virtual machine that executes your job. `ubuntu-latest` gives you a clean Linux machine with common tools pre-installed.

```yaml
name: CI                           # Workflow name (shows on GitHub)

on:
  push:
    branches: [main]               # Trigger: every push to main
  pull_request:
    branches: [main]               # Trigger: every PR targeting main

jobs:
  test:                            # Job name
    runs-on: ubuntu-latest         # Fresh Linux VM
    steps:
      - uses: actions/checkout@v4  # Step 1: download your code
      - uses: actions/setup-python@v5  # Step 2: install Python
      - run: pip install ...       # Step 3: install dependencies
      - run: pytest tests/ -v      # Step 4: run tests
```

### Why Tests Run on a Clean Machine

Your laptop has Python installed, libraries cached, environment variables set, model files in the right place. It's configured specifically for this project.

The GitHub Actions runner is a **blank slate** — nothing is pre-configured. If your tests pass there, it proves your code works from scratch, not just on your machine.

This catches problems like:
- Missing dependencies not listed in `requirements.txt`
- Hardcoded file paths that only exist on your machine
- Environment variables you set manually but forgot to document

### Our Pipeline — Two Jobs

```
┌─────────────────────────────┐
│  Job 1: test                │
│  ─────────────              │
│  1. Checkout code           │
│  2. Setup Python 3.10       │
│  3. Install CPU PyTorch     │
│  4. Install all deps        │
│  5. Run pytest (13 tests)   │
│                             │
│  ~30 seconds                │
└──────────┬──────────────────┘
           │ passes?
           ↓
┌─────────────────────────────┐
│  Job 2: docker-build        │
│  ─────────────              │
│  1. Checkout code           │
│  2. Setup Docker Buildx     │
│  3. Build backend image     │
│  4. Build frontend image    │
│                             │
│  ~5 minutes                 │
└─────────────────────────────┘
```

Job 2 has `needs: test` — it only runs if tests pass. If tests fail, Docker build is skipped (saves ~5 minutes of compute).

### The Green ✓ / Red ✗ Feedback Loop

After each push, GitHub shows a status icon next to the commit:
- **Green ✓** — all jobs passed, code is healthy
- **Red ✗** — something failed, click to see which test/step broke
- **Yellow ●** — pipeline is still running

This is visible on the GitHub repo page, in pull requests, and in commit history. Your team (or professor) can see at a glance whether the codebase is healthy.

### What We Implemented (Code ↔ Concepts)

| Concept | Implementation |
|---|---|
| Workflow trigger | `on: push` to main + pull requests |
| Test job | Python 3.10, CPU-only PyTorch, pytest |
| Docker build job | Buildx, builds both backend + frontend images |
| Job dependency | `needs: test` — Docker only builds if tests pass |
| Pip caching | `cache: "pip"` in setup-python — faster subsequent runs |
| Cost | Free for public repos, 2000 min/month for private |

### Files Created

| File | What it does |
|---|---|
| `.github/workflows/ci.yml` | CI/CD pipeline — test then build Docker images on every push |
