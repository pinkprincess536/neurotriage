# Deployment Guide

Topology: **backend** runs in Docker on an **AWS EC2 VM** behind Caddy (automatic
HTTPS); **frontend** deploys to **Vercel**; **Supabase** stays as the managed DB +
storage.

```
Browser ──HTTPS──> Vercel (React)
   │
   └──HTTPS──> Caddy (443) ──> backend:8000 (FastAPI)  [EC2 VM]
                                   │
                                   └──> Supabase (Postgres + Storage)
```

---

## 1. VM requirements

The backend runs CPU PyTorch + MNE and loads whole EDF recordings into RAM during
inference/retraining (EDFs themselves live in Supabase, not on the VM).

| Resource | Minimum | Recommended |
|---|---|---|
| Instance | `t3.small` (2 vCPU / 2 GB) | `t3.medium` (2 vCPU / 4 GB) |
| Disk (EBS gp3) | 20 GB | 30 GB |
| OS | Ubuntu 22.04/24.04 LTS | same |
| Public IP | Elastic IP (so DNS stays valid across restarts) | same |

Notes:
- **Avoid free-tier `t2.micro`/`t3.micro` (1 GB RAM)** — PyTorch + EDF processing will
  OOM.
- On a 2 GB instance, add 2 GB swap to survive retrain spikes:
  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```
- Disk: the backend image (~2 GB with CPU torch) + Caddy + OS need headroom; 8 GB is
  not enough.

---

## 2. AWS setup

1. Launch the instance (Ubuntu LTS) and attach an **Elastic IP**.
2. **Security Group** inbound rules:
   - `22/tcp` from your IP (SSH)
   - `80/tcp` from `0.0.0.0/0` (HTTP — needed for Let's Encrypt challenge + redirect)
   - `443/tcp` from `0.0.0.0/0` (HTTPS)
   - Do **not** open `8000`.
3. **DNS**: create an `A` record for `api.your-domain.com` → the Elastic IP.

---

## 3. Backend on the VM

```bash
# Install Docker + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# Get the code
git clone <your-repo-url> eeg && cd eeg

# Configure environment
cp .env.example .env
# then edit .env and set:
#   SUPABASE_URL, SUPABASE_KEY
#   ADMIN_PASSWORD, DOCTOR_PASSWORD   (strong values!)
#   JWT_SECRET                         (openssl rand -hex 32)
#   DOMAIN=api.your-domain.com
#   ACME_EMAIL=you@your-domain.com
#   CORS_ORIGINS=https://<your-app>.vercel.app   (set after the Vercel deploy)

# Start backend + Caddy (auto-provisions TLS)
docker compose -f docker-compose.prod.yml up -d --build

# Verify (after DNS has propagated):
curl https://api.your-domain.com/health   # -> {"status":"ok","model_loaded":true}
```

In the **Supabase dashboard**, create a private Storage bucket named
`eeg-recordings` (the app also attempts to create it on startup if the key allows).

---

## 4. Frontend on Vercel

1. Import the repo into Vercel.
2. **Root Directory** = `eeg-triage` (Vite is auto-detected; `vercel.json` is included).
3. **Environment Variable**:
   - `VITE_BACKEND_URL = https://api.your-domain.com`
4. Deploy. Note the resulting URL, e.g. `https://your-app.vercel.app`.

`VITE_BACKEND_URL` is baked at build time, so **redeploy** if you change it.

---

## 5. Wire CORS + smoke test

1. On the VM, set `CORS_ORIGINS=https://your-app.vercel.app` in `.env`, then:
   ```bash
   docker compose -f docker-compose.prod.yml up -d   # picks up new env
   ```
2. Open the Vercel URL and run the full flow over HTTPS:
   - Log in (admin + doctor)
   - Create a patient → upload an EDF → review flagged windows → submit feedback
   - Admin: view model versions → retrain → activate

---

## 6. Operations

```bash
docker compose -f docker-compose.prod.yml logs -f backend   # logs
docker compose -f docker-compose.prod.yml pull && \
docker compose -f docker-compose.prod.yml up -d --build      # update/redeploy
```

- Retrained model versions persist via the `./model` bind mount across rebuilds.
- Caddy auto-renews certificates; certs persist in the `caddy_data` volume.
