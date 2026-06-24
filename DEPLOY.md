# Deployment Guide

This document explains the concepts behind how NeuroTriage is deployed, and then walks through the actual setup steps. The concepts section is written as study material — to help you understand *why* we made each decision, not just what commands to run.

---

## Concepts — Understanding the Deployment Stack

### What is a Docker Image?

Think of a Docker image as a **recipe for a computer program**. It contains everything the program needs to run — the code, the Python version, all the libraries, the configuration — packed into a single self-contained bundle.

You build an image once. Then you can run it anywhere — your laptop, a server in the cloud, a colleague's machine — and it will behave exactly the same way every time. No "it works on my machine" problems.

### What is a Docker Container?

A container is what you get when you **run** a Docker image. If the image is the recipe, the container is the meal — the actual running instance of your program.

You can run multiple containers from the same image simultaneously. Each one is isolated from the others. If a container crashes, you just restart it — the image is untouched.

In NeuroTriage:
- One container runs the **backend** (the FastAPI Python server + AI model)
- One container runs the **frontend** (the React app served via Nginx)
- Caddy runs as another service handling HTTPS

Docker Compose lets you define and start all of these together with a single command.

---

### What is AWS EC2?

**Amazon EC2 (Elastic Compute Cloud)** is a service that lets you rent a virtual computer (called an "instance") in Amazon's data centres. You choose how much CPU and RAM you want, pick an operating system (we used Ubuntu), and within minutes you have a server running in the cloud that you can SSH into and do anything with.

Think of it like renting a desk in a massive office building (Amazon's data centre). You don't own the building or the desk — you just pay for the time you use it.

**Why we used EC2:**
The NeuroTriage backend needs to run a PyTorch model and process large EEG files. That requires a real server with enough RAM — EC2 gave us a `t3.medium` instance with 4 GB of RAM at low cost.

**Why not just run it locally?**
If you run the backend on your laptop, it's only accessible when your laptop is on and connected. EC2 instances run 24/7 in the cloud and are accessible from anywhere.

---

### What is an Elastic IP?

Normally, when you stop and restart an EC2 instance, it gets a different IP address each time. That means any DNS records or links pointing to the old IP break.

An **Elastic IP** is a static, fixed public IP address that you attach to your EC2 instance. It stays the same even if you stop and restart the server. This is essential for DNS — you need a stable address to point your domain name at.

---

### What is DuckDNS?

**DuckDNS** is a free service that gives you a domain name (like `neurotriage.duckdns.org`) and lets you point it to any IP address you want.

The problem it solves: domain names like `api.neurotriage.duckdns.org` are human-readable and memorable. IP addresses like `54.123.45.67` are not. DuckDNS creates a mapping between the two.

**Why we needed it:**
- SSL/TLS certificates (HTTPS) require a domain name — you can't get a certificate for a raw IP address
- The frontend (on Vercel) needs to call the backend. A domain name is much cleaner than a raw IP
- DuckDNS is free and takes about 2 minutes to set up

**How it works:**
1. You register a subdomain on duckdns.org (e.g. `neurotriage.duckdns.org`)
2. You tell DuckDNS "this domain points to IP address X" (your EC2 Elastic IP)
3. When anyone types `neurotriage.duckdns.org` in a browser, DNS resolves it to your EC2 IP

---

### What is Port Forwarding?

Every server listens for connections on numbered "ports". Think of ports like doors in a building — each door leads to a different room (service).

Common ports:
- **Port 80** — standard HTTP (unencrypted web traffic)
- **Port 443** — standard HTTPS (encrypted web traffic)
- **Port 8000** — where our FastAPI backend listens internally
- **Port 22** — SSH (remote terminal access)

**The problem:** Our FastAPI server runs on port 8000. But users connect to port 443 (HTTPS). We can't expose port 8000 directly to the internet — it's not HTTPS, and it's a security risk.

**Port forwarding (via Caddy):** We run Caddy as a reverse proxy. Caddy:
1. Listens on port 443 (the public internet-facing port)
2. Receives incoming requests
3. Forwards them internally to port 8000 (where FastAPI is running)
4. Takes the response from FastAPI and sends it back to the user

From the user's perspective, they're talking to `https://neurotriage.duckdns.org`. Behind the scenes, Caddy is transparently routing that to `localhost:8000`.

We also blocked port 8000 from the public internet in the AWS Security Group — so the only way to reach the backend is through Caddy on port 443.

---

### What is Caddy?

**Caddy** is a web server and reverse proxy. It sits in front of our FastAPI backend and handles two things:

1. **HTTPS / TLS** — Caddy automatically gets a free SSL certificate from Let's Encrypt and renews it before it expires. This is what makes `https://` work. Without it, browsers would show a scary "not secure" warning.

2. **Reverse proxy** — Caddy forwards incoming HTTPS requests to the backend running on port 8000 (see port forwarding above)

The alternative would be manually managing SSL certificates — getting them, installing them, remembering to renew them every 90 days. Caddy does all of this automatically.

---

### What is Vercel?

**Vercel** is a platform for deploying frontend web apps. You connect your GitHub repo, tell it which folder contains your frontend code (`eeg-triage/`), and it builds and deploys your app automatically on every push.

Vercel handles:
- Building the React app (`npm run build`)
- Hosting the static files on a global CDN (fast load times everywhere)
- HTTPS out of the box
- Automatic redeployment when you push to main

The frontend is just static files (HTML, CSS, JavaScript) after building — it doesn't need a server to run, just a place to be served from. Vercel is perfect for this.

---

### Why Split Frontend and Backend?

The frontend (React) and backend (FastAPI + PyTorch) have very different requirements:

| | Frontend | Backend |
|---|---|---|
| What it is | Static files | Python server + 2GB PyTorch |
| What it needs | CDN, fast global delivery | RAM, CPU, persistent storage |
| Best hosted on | Vercel (free, global CDN) | EC2 (full Linux VM) |

Running them together on EC2 would work but wastes Vercel's free tier and adds unnecessary complexity. Splitting them means each part is hosted on the platform best suited to it.

---

### The Full Picture

```
User opens browser
        ↓
Vercel serves the React frontend (HTML/JS/CSS)
        ↓
React app makes API calls to https://neurotriage.duckdns.org
        ↓
DuckDNS resolves that domain → EC2 Elastic IP
        ↓
Traffic hits EC2 on port 443
        ↓
Caddy receives it, terminates HTTPS, forwards to localhost:8000
        ↓
FastAPI backend processes the request (runs the AI model, queries Supabase)
        ↓
Response goes back through Caddy → back to the browser
```

---

## Setup Steps

### 1. VM Requirements

The backend runs CPU PyTorch + MNE and loads whole EDF recordings into RAM during inference and retraining.

| Resource | Minimum | Recommended |
|---|---|---|
| Instance | `t3.small` (2 vCPU / 2 GB) | `t3.medium` (2 vCPU / 4 GB) |
| Disk (EBS gp3) | 20 GB | 30 GB |
| OS | Ubuntu 22.04/24.04 LTS | same |
| Public IP | Elastic IP | same |

Avoid `t2.micro`/`t3.micro` (1 GB RAM) — PyTorch + EDF processing will OOM.

On a 2 GB instance, add swap to survive retrain spikes:
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

### 2. AWS Setup

1. Launch an Ubuntu LTS EC2 instance and attach an **Elastic IP**
2. Security Group inbound rules:
   - `22/tcp` — SSH (your IP only)
   - `80/tcp` — HTTP (needed for Let's Encrypt ACME challenge)
   - `443/tcp` — HTTPS (public)
   - Do **not** open `8000`
3. Point your DuckDNS subdomain to the Elastic IP

---

### 3. Backend on the VM

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# Clone the repo
git clone <your-repo-url> eeg && cd eeg

# Configure environment
cp .env.example .env
# Edit .env:
#   SUPABASE_URL, SUPABASE_KEY
#   ADMIN_PASSWORD, DOCTOR_PASSWORD
#   JWT_SECRET  (generate: openssl rand -hex 32)
#   DOMAIN=neurotriage.duckdns.org
#   ACME_EMAIL=you@email.com
#   CORS_ORIGINS=https://<your-app>.vercel.app

# Start backend + Caddy
docker compose -f docker-compose.prod.yml up -d --build

# Verify
curl https://neurotriage.duckdns.org/health
# → {"status":"ok","model_loaded":true}
```

In Supabase dashboard, create a private storage bucket named `eeg-recordings`.

---

### 4. Frontend on Vercel

1. Import the repo into Vercel
2. Set **Root Directory** to `eeg-triage`
3. Add environment variable: `VITE_BACKEND_URL = https://neurotriage.duckdns.org`
4. Deploy — note the resulting Vercel URL

`VITE_BACKEND_URL` is baked at build time — redeploy if you change it.

---

### 5. Wire CORS and Test

```bash
# On the VM, update CORS_ORIGINS with the Vercel URL
# Edit .env: CORS_ORIGINS=https://your-app.vercel.app
docker compose -f docker-compose.prod.yml up -d
```

Test the full flow:
- Log in as doctor → create patient → upload EDF → review windows → submit feedback
- Log in as admin → view model versions → retrain → activate

---

### 6. Operations

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f backend

# Update and redeploy
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --build
```

- Retrained model versions persist via the `./model` bind mount across rebuilds
- Caddy auto-renews TLS certificates; certs persist in the `caddy_data` volume
