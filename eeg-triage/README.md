# EEG Seizure Triage — Frontend

React + Vite single-page app for the EEG Seizure Triage Assistant. Doctors upload
EEG recordings and review AI-flagged windows; admins manage and retrain model versions.

## Setup

```bash
npm install
npm run dev      # start dev server (default http://localhost:5173)
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Configuration

The frontend talks to the backend via a single env var:

| Variable | Description | Default |
|---|---|---|
| `VITE_BACKEND_URL` | Base URL of the FastAPI backend | `http://localhost:8000` |

Set it in `.env` for local dev, or as a build-time env var on your host (e.g. Vercel
project settings). It is read in `src/config.js` and baked in at build time.

## Structure

| Path | Purpose |
|---|---|
| `src/App.jsx` | Root component: auth, doctor + admin views |
| `src/config.js` | Backend URL config |
| `src/components/Login.jsx` | Password login |
| `src/components/PatientManager.jsx` | Select / create patients |
| `src/components/FileUpload.jsx` | EDF file picker |
| `src/components/ThresholdSlider.jsx` | Sensitivity control |
| `src/components/ResultsTable.jsx` | Flagged windows + feedback |

Authenticated calls send `Authorization: Bearer <token>` where the token is the JWT
returned by the backend `/login` endpoint.
