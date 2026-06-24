# NeuroTriage — System Architecture

> Render this diagram at [mermaid.live](https://mermaid.live) (paste the code block) or open in VS Code with a Mermaid extension, then screenshot for LinkedIn.

```mermaid
flowchart TB
    subgraph USER[" "]
        direction TB
        U["👩‍⚕️ Neurologist / Admin<br/>(Browser)"]
    end

    subgraph VERCEL["☁️ Vercel — Global CDN"]
        FE["⚛️ React Frontend<br/>(static HTML / CSS / JS)"]
    end

    subgraph EC2["🖥️ AWS EC2 — Linux VM (Docker Compose)"]
        direction TB
        CADDY["🔒 Caddy — Reverse Proxy<br/>Port 443 · Auto HTTPS (Let's Encrypt)"]
        BE["⚡ FastAPI + PyTorch Backend<br/>Port 8000 (internal only)<br/>EEGCNN1D model loaded in memory"]
        CADDY -->|forwards| BE
    end

    subgraph SUPA["☁️ Supabase"]
        DB["🗄️ Postgres<br/>patients · recordings · feedback"]
        STORE["📁 Storage<br/>EDF recordings"]
    end

    U -->|"loads app (HTTPS)"| FE
    FE -->|"API calls (HTTPS)"| CADDY
    BE -->|"read / write"| DB
    BE -->|"upload / download EDF"| STORE

    DNS["🌐 DuckDNS<br/>neurotriage.duckdns.org<br/>→ Elastic IP (fixed)"]
    FE -.->|"resolves domain"| DNS
    DNS -.->|"points to"| CADDY

    style USER fill:#fdf2f8,stroke:#ec4899
    style VERCEL fill:#eef2ff,stroke:#6366f1
    style EC2 fill:#f0fdf4,stroke:#22c55e
    style SUPA fill:#fffbeb,stroke:#f59e0b
    style CADDY fill:#fee2e2,stroke:#ef4444
    style BE fill:#dcfce7,stroke:#16a34a
```

---

## ML Inference & Feedback Loop

```mermaid
flowchart LR
    A["📤 Upload EDF"] --> B["🧹 Preprocess<br/>0.5–40 Hz bandpass<br/>60 Hz notch<br/>7s windows, 30% overlap<br/>z-score normalize"]
    B --> C["🧠 EEGCNN1D<br/>score each window"]
    C --> D["📊 Rank by probability<br/>🔴 Urgent ≥0.95<br/>🟡 Review ≥ threshold"]
    D --> E["👩‍⚕️ Doctor reviews<br/>✓ / ✗ on each window"]
    E --> F["💾 Feedback stored<br/>(linked to timestamp)"]
    F --> G["🔁 Admin triggers retrain<br/>fine-tune (LR 0.0001)"]
    G --> H["🚦 Promotion gate<br/>recall ≥ baseline?"]
    H -->|"passes"| I["✅ Admin activates<br/>new version goes live"]
    H -->|"fails"| J["🚫 Blocked"]
    I -.->|"improved model"| C

    style C fill:#dcfce7,stroke:#16a34a
    style H fill:#fef3c7,stroke:#f59e0b
    style I fill:#dbeafe,stroke:#3b82f6
```
