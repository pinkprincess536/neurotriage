# Project Plan — EEG Seizure Triage Assistant (MLOps + DevOps)

This file captures the full project roadmap, what's been built, and what's remaining.

---

## Project Vision

An ML-powered EEG seizure detection system with a **complete MLOps lifecycle**:
- Doctors upload EEG recordings → AI flags suspicious windows → Doctors correct the AI
- Admin retrains the model using doctor feedback → Compares versions → Activates the best one
- Everything containerized, tested, and deployed through CI/CD

---

## Roadmap & Progress

### Phase 1: ML Pipeline (COMPLETE)
- [x] EEG preprocessing pipeline (bandpass filter, notch filter, windowing)
- [x] 1D CNN model (EEGCNN1D) trained on CHB-MIT dataset
- [x] Inference API — upload EDF → flagged windows with scores
- [x] Threshold-based triage (aggressive/balanced/conservative)

### Phase 2: Feedback Loop (COMPLETE)
- [x] Doctor feedback buttons (seizure ✓ / not seizure ✗)
- [x] Feedback saved to Supabase (linked to recording_id + timestamp)
- [x] Retraining pipeline — fetches feedback, downloads EDFs, fine-tunes model
- [x] Deep copy training — active model untouched during retraining

### Phase 3: Model Versioning (COMPLETE)
- [x] Versioned weight files (eegcnn1d_weights_v1.pth, v2.pth, etc.)
- [x] model_config.json tracks all versions + active version
- [x] Admin activates versions — hot-swaps weights in memory
- [x] Evaluation metrics per version (accuracy, recall, precision, specificity, F1)
- [x] Original model gets test metrics from test_metrics.json

### Phase 4: Auth & Role Separation (COMPLETE)
- [x] Admin vs Doctor roles with token-based sessions
- [x] Doctor view: patient manager, upload, results, feedback
- [x] Admin view: model versions table with metrics, retrain, activate
- [x] Admin-only endpoints protected (403 for doctors)

### Phase 5: Production Config (COMPLETE)
- [x] CORS_ORIGINS env var (configurable per environment)
- [x] VITE_BACKEND_URL env var via shared config.js
- [x] .env.example template

### Phase 6: Docker Containerization (COMPLETE)
- [x] Backend Dockerfile — Python 3.10 slim + CPU-only PyTorch
- [x] Frontend Dockerfile — multi-stage Node build → Nginx serve
- [x] nginx.conf — SPA routing + static caching
- [x] docker-compose.yml — both services + env_file + health check
- [x] .dockerignore files — excludes .git, .env, notebooks, node_modules

### Phase 7: Automated Testing (COMPLETE)
- [x] 13 pytest API tests covering all endpoints
- [x] Mocked Supabase — tests run without real database
- [x] Auth tests — verify admin-only endpoints reject doctor tokens
- [x] conftest.py with session-scoped fixtures
- [x] requirements-dev.txt for test dependencies

### Phase 8: CI/CD (COMPLETE)
- [x] GitHub Actions workflow (.github/workflows/ci.yml)
- [x] Job 1: test — Python 3.10, CPU PyTorch, pytest
- [x] Job 2: docker-build — builds both images, runs only if tests pass
- [x] Triggered on push to main + pull requests

### Phase 9: MLflow Integration (NOT STARTED)
- [ ] Track retraining experiments (hyperparams, metrics, artifacts)
- [ ] Compare runs side-by-side
- [ ] Log each retrain to MLflow tracking server
- [ ] Store model artifacts in MLflow

### Phase 10: Deployment (NOT STARTED)
- [ ] Deploy backend to Railway/Render
- [ ] Deploy frontend to Railway/Render/Vercel
- [ ] Configure production env vars (CORS_ORIGINS, VITE_BACKEND_URL, Supabase)
- [ ] Add deploy step to CI/CD pipeline (auto-deploy on green tests)
- [ ] HTTPS configuration

### Phase 11: README (NOT STARTED)
- [ ] Project overview + architecture diagram
- [ ] Tech stack, features, project structure
- [ ] Setup instructions (local + Docker)
- [ ] API endpoints, environment variables
- [ ] Model details + MLOps pipeline explanation
- [ ] Roadmap

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         DOCTOR FLOW                              │
│  Login → Select Patient → Upload EDF → View Results → Feedback  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ feedback saved to Supabase
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│                         ADMIN FLOW                               │
│  Login → View Model Versions (metrics) → Retrain → Activate     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         CI/CD PIPELINE                           │
│  Push to main → pytest (13 tests) → Docker build → (Deploy)     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn |
| ML | PyTorch (EEGCNN1D), MNE (EEG processing), NumPy |
| Frontend | React 19, Vite 8 |
| Database | Supabase (PostgreSQL + Storage) |
| Auth | Token-based sessions (in-memory) |
| Containerization | Docker, Docker Compose, Nginx |
| CI/CD | GitHub Actions |
| Testing | pytest, FastAPI TestClient, unittest.mock |

---

## Key Files

| File | Purpose |
|---|---|
| `backend.py` | FastAPI server — all API endpoints |
| `retrain.py` | Retraining pipeline — feedback → fine-tune → metrics → save |
| `eeg_core.py` | Shared EEG processing + model logic |
| `model/` | Model weights, config, normalization stats |
| `eeg-triage/` | React frontend |
| `eeg-triage/src/config.js` | Shared VITE_BACKEND_URL config |
| `Dockerfile` | Backend container |
| `eeg-triage/Dockerfile` | Frontend container (multi-stage) |
| `docker-compose.yml` | Service orchestration |
| `.github/workflows/ci.yml` | CI/CD pipeline |
| `tests/` | pytest API tests |
| `MLOPS.md` | MLOps learning documentation |
| `.env.example` | Environment variable template |

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | (required) |
| `SUPABASE_KEY` | Supabase anon key | (required) |
| `DOCTOR_PASSWORD` | Password for doctor login | `eeg-demo` |
| `ADMIN_PASSWORD` | Password for admin login | `eeg-admin` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,...` |
| `VITE_BACKEND_URL` | Backend API URL for frontend | `http://localhost:8000` |

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | None | Server + model status |
| `/login` | POST | None | Returns token + role (admin/doctor) |
| `/patients` | GET | None | List all patients |
| `/patients` | POST | None | Create patient |
| `/patients/{id}/upload` | POST | None | Upload EDF → inference results |
| `/feedback` | POST | None | Save doctor feedback |
| `/retrain` | POST | Admin | Retrain model from feedback |
| `/models` | GET | Admin | List all model versions + metrics |
| `/models/activate` | POST | Admin | Switch active model version |

---

## Commands

```bash
# Local development
uvicorn backend:app --reload              # Backend
cd eeg-triage && npm run dev              # Frontend

# Run tests
pytest tests/ -v

# Docker
docker compose up --build                 # Start everything
docker compose down                       # Stop everything

# Git
git fetch origin main && git reset --hard origin/main   # Force pull
```
