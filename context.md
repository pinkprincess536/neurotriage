# CLAUDE.md

## Project Overview

The project is an **EEG Seizure Triage Assistant**.

Core idea (user intent preserved):
> "We want to build a tool that helps doctors who read EEG (brainwave) recordings."

Problem being solved:
- Neurologists manually review **hours of EEG recordings** to find short seizure events.
- This process is **slow and cognitively exhausting**.

Proposed system:
- Takes long EEG recordings
- Automatically identifies segments that “look like” seizures
- Ranks and surfaces the most relevant segments first
- Provides a clean interface for review
- Learns from doctor feedback over time

> "The goal is not just to detect seizures once. The goal is to help doctors work faster and smarter every day by giving them a triage assistant that sits between raw data and final decisions." :contentReference[oaicite:0]{index=0}


---

## What Already Exists

The project builds on:

### Datasets
- CHB-MIT EEG dataset

These provide:
- Large-scale labeled seizure data
- Real clinical EEG recordings

### Research + Code
- Existing seizure detection pipelines (CNNs, signal processing)
- Open-source implementations for preprocessing and training

### Evaluation Frameworks
- Metrics like:
  - Sensitivity (recall)
  - False alarms per hour
  - AUROC
- Frameworks like SzCORE

Key takeaway:
- Detection models exist
- End-to-end usable systems do not


---

## Gap This Project Fills

Most existing work stops at:
- Offline experiments
- Research metrics
- Scripts and notebooks

Missing piece:
> A real, usable triage assistant with workflow, UI, and feedback loop

This project focuses on:
- Productization
- MLOps system design
- Human-in-the-loop learning


---

## System Architecture

### 1. Data Pipeline

Tasks:
- Download TUH / CHB-MIT datasets
- Read raw `.edf` EEG files
- Preprocess signals:
  - Bandpass filtering (0.5–40 Hz)
  - Notch filtering
  - Artifact removal
- Slice into windows (5–30 seconds)
- Align seizure annotations

Output:
- Structured dataset of labeled EEG segments


---

### 2. Feature Engineering

Approach:
- Convert EEG signals into time-frequency representations

Techniques:
- STFT (Short-Time Fourier Transform)
- Spectrogram generation

Reason:
- Enables CNN-based learning (image-like input)


---

### 3. Model Training

Baseline:
- CNN trained on spectrograms

Capabilities:
- Binary classification (seizure vs non-seizure)
- Handle class imbalance
- Evaluate using domain-relevant metrics

Tracking:
- MLflow for:
  - Parameters
  - Metrics
  - Model versions


---

### 4. Backend Service (Inference Layer)

Technology:
- FastAPI

Endpoints:
- `POST /predict`
- `GET /recordings`

Behavior:
- Load model at startup
- Process full EEG recordings
- Return ranked seizure segments

Scaling:
- Use async jobs (Celery + Redis)


---

### 5. Frontend (Triage UI)

Goal:
> "Don't over-engineer the UI."

Recommended:
- Streamlit for speed

Features:
- Patient selection
- Recording selection
- Ranked segment list
- EEG waveform viewer
- Feedback buttons:
  - "True seizure"
  - "Not a seizure"


---

### 6. Feedback Loop

Core idea:
- System improves through usage

Mechanism:
- Store doctor feedback
- Link feedback to segments
- Use feedback to:
  - Retrain models
  - Adjust thresholds

Trigger:
- Retrain after sufficient new labels


---

### 7. MLOps Infrastructure

Foundation includes:

#### Versioning
- Git for code
- DVC for datasets

#### Experiment Tracking
- MLflow

#### Containerization
- Docker + docker-compose

#### CI/CD
- GitHub Actions:
  - Test
  - Build
  - Deploy

#### Monitoring
- Track:
  - Prediction drift
  - False alarm rate
  - Data distribution changes

- Tools:
  - Prometheus
  - Grafana


---

## Development Roadmap

### Phase 1 — Foundation (Week 1–2)
- Python environment setup
- Git + GitHub
- Docker basics
- Explore EEG data

### Phase 2 — Data Pipeline (Week 2–4)
- Signal preprocessing
- Windowing + labeling
- Feature extraction
- Data versioning (DVC)

### Phase 3 — Modeling (Week 3–5)
- Train CNN baseline
- Track experiments (MLflow)
- Proper evaluation metrics

### Phase 4 — Backend (Week 5–7)
- FastAPI service
- Dockerization
- Async job queue

### Phase 5 — Frontend (Week 7–9)
- Streamlit dashboard
- EEG visualization
- Feedback capture

### Phase 6 — Feedback Loop (Week 9–11)
- Retraining pipeline
- Threshold tuning

### Phase 7 — Monitoring & CI/CD (Week 11–13)
- Model monitoring
- Data drift detection
- CI/CD pipelines


Reference roadmap UI: :contentReference[oaicite:1]{index=1}


---

## Key Design Principles

- Focus on **end-to-end system**, not just model accuracy
- Prioritize **doctor workflow usability**
- Build **feedback-driven improvement loop**
- Treat project as **real MLOps system**, not a notebook experiment
- Avoid over-engineering early (especially frontend)


---

## User Context (Behavior & Preferences)

- The user is:
  - Learning by building real systems
  - Focused on practical, production-style implementations
  - Working across frontend + backend + ML stack

- Existing parallel work:
  - Debugging Supabase-connected admin dashboard
  - Building projects to compensate for weak teaching quality

- Learning style:
  - Prefers step-by-step actionable guidance
  - Values real-world architecture over theory


---

## Expected End State

A system that:

- Accepts EEG recordings
- Automatically detects and ranks seizure-like segments
- Provides a usable triage interface for doctors
- Collects feedback
- Continuously improves through retraining
- Operates with full MLOps lifecycle

> "We will build the bridge from that detection capability to a usable, end-to-end tool for doctors, with data pipelines, services, a user interface, feedback, and monitoring." :contentReference[oaicite:2]{index=2}