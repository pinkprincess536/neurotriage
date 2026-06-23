# EEG Triage

An AI-powered EEG seizure detection and triage system. Neurologists upload EDF recordings, and a 1D CNN model scores each 7-second window for seizure probability — surfacing the most urgent segments first so doctors can review faster.

---

## Architecture

```
Browser ──HTTPS──> Vercel (React + Tailwind)
   │
   └──HTTPS──> Caddy (443) ──> FastAPI backend (Docker on EC2)
                                   │
                                   └──> Supabase (Postgres + Storage)
```

| Layer | Tech |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Vite |
| Backend | FastAPI, Python 3.10, PyTorch (CPU), MNE |
| Database | Supabase (Postgres + object storage) |
| Auth | JWT (role-based: `doctor` / `admin`) |
| ML Model | `EEGCNN1D` — 3-layer 1D CNN, 22 channels |
| Infra | Docker, Caddy (auto-TLS), AWS EC2, Vercel |
| CI | GitHub Actions |

---

## Features

- **EDF upload & scoring** — processes recordings into 7s overlapping windows, scores each with the CNN, flags windows above a configurable threshold
- **Triage tiers** — `urgent` (≥ 0.95) and `review` (≥ threshold) to prioritize doctor attention
- **Doctor feedback loop** — doctors label flagged windows; labels feed the retraining pipeline
- **Model versioning** — multiple model versions tracked in `model_config.json`; admin can retrain and activate versions
- **Patient management** — create/delete patients, attach recordings, browse history
- **MLflow tracking** — retrain runs logged with metrics and artifacts

---

## Quick Start (Docker)

```bash
# 1. Clone and configure
git clone <repo-url> eeg && cd eeg
cp .env.example .env
# Edit .env — set SUPABASE_URL, SUPABASE_KEY, DOCTOR_PASSWORD, ADMIN_PASSWORD, JWT_SECRET

# 2. Start backend + frontend
docker compose up --build

# Backend:  http://localhost:8000
# Frontend: http://localhost:80
```

In your **Supabase dashboard**, create a private storage bucket named `eeg-recordings`.

---

## Local Development

### Backend

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt -r requirements-dev.txt

uvicorn backend:app --reload
# → http://localhost:8000
```

### Frontend

```bash
cd eeg-triage
npm install
npm run dev
# → http://localhost:5173
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |
| `DOCTOR_PASSWORD` | Login password for doctor role |
| `ADMIN_PASSWORD` | Login password for admin role |
| `JWT_SECRET` | Secret for signing JWTs (`openssl rand -hex 32`) |
| `JWT_EXPIRY_HOURS` | Token lifetime in hours (default: 12) |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |
| `DOMAIN` | Your API domain (production only, used by Caddy) |
| `ACME_EMAIL` | Email for Let's Encrypt certificate (production only) |

---

## API Reference

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/health` | public | Health check |
| `POST` | `/login` | public | Returns JWT token + role |
| `GET` | `/patients` | doctor/admin | List all patients |
| `POST` | `/patients` | doctor/admin | Create patient |
| `DELETE` | `/patients/{id}` | doctor/admin | Delete patient + recordings |
| `POST` | `/patients/{id}/upload` | doctor/admin | Upload EDF, returns flagged windows |
| `GET` | `/patients/{id}/recordings` | doctor/admin | List recordings for patient |
| `GET` | `/recordings/{id}/windows` | doctor/admin | Get flagged windows for recording |
| `POST` | `/feedback` | doctor/admin | Submit doctor label for a window |
| `POST` | `/retrain` | admin | Trigger model retraining |
| `GET` | `/models` | admin | List model versions |
| `POST` | `/models/activate` | admin | Activate a model version |

---

## ML Model

**`EEGCNN1D`** — a 3-layer 1D convolutional network:

- Input: 22 EEG channels × 1792 time samples (7 seconds at 256 Hz)
- Conv layers: 32 → 64 → 128 filters with batch norm and max pooling
- Output: 2-class softmax (seizure / non-seizure)

**Preprocessing pipeline:**
1. Channel selection (22 standard bipolar channels)
2. Bandpass filter: 0.5–40 Hz
3. Notch filter: 60 Hz
4. Sliding windows: 7s, 30% overlap
5. Z-score normalization using training mean/std

**Retraining:** Admin triggers `/retrain` → feedback labels from Supabase are merged with original training data → new version saved → promote via `/models/activate` (gated by evaluation metrics).

---

## CI / CD

GitHub Actions runs on every push and pull request to `main`:

1. **`test` job** — installs CPU PyTorch, project dependencies, then runs `pytest tests/ -v`
2. **`docker-build` job** — builds both the backend and frontend Docker images (no push)

The `docker-build` job only runs if tests pass.

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for the full workflow.

---

## Project Structure

```
eeg/
├── backend.py            # FastAPI app, all API routes
├── eeg_core.py           # Model definition, EDF processing, inference
├── retrain.py            # Retraining pipeline, model versioning
├── preprocessing.py      # Preprocessing utilities
├── inference.py          # Standalone inference script
├── model/                # Model weights + config (bind-mounted in Docker)
├── ml/                   # Training scripts and datasets
├── tests/                # Pytest test suite
├── eeg-triage/           # React frontend (Vite + Tailwind)
│   └── src/
│       └── components/   # Login, Dashboard, FileUpload, AdminPanel, etc.
├── docker-compose.yml         # Local dev compose
├── docker-compose.prod.yml    # Production compose (with Caddy)
├── Caddyfile             # Reverse proxy + auto-TLS config
└── .github/workflows/    # CI pipeline
```

---

## Deployment

Full production deployment guide: [DEPLOY.md](DEPLOY.md)

**Summary:**
- Backend: Docker on AWS EC2 (`t3.medium` recommended) behind Caddy for HTTPS
- Frontend: Deploy `eeg-triage/` to Vercel with `VITE_BACKEND_URL` pointing to your API domain
- Database: Supabase (managed Postgres + private storage bucket)

---

## Running Tests

```bash
pytest tests/ -v
```

Tests cover the API endpoints and retraining pipeline. See `tests/` for details.
