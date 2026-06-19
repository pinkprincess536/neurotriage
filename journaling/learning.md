# What I Learned Building the Backend

Lessons from building `inference.py` and `backend.py` for the EEG Seizure Triage Assistant.

---

## 1. Filter Before Windowing — Why Order Matters

### The wrong order

```
Continuous EEG → Windowing → 1000 windows → Filter each window
```

### The right order

```
Continuous EEG → Filter once → Windowing → 1000 clean windows
```

### Why

**Computational cost.** Filtering is a convolution operation that runs over every sample. If you have a 1-hour recording at 256 Hz = 921,600 samples per channel, filtering once does 921,600 × 22 channels of work. Window into 1,000 windows first and you do the same work 1,000 times.

**Filter transients.** FIR filters have a "warm-up" period at the start of any signal segment where the filter's internal state isn't yet stabilized. This creates edge artifacts (ringing) at the boundaries. Filtering each window independently creates edge artifacts at every window boundary — 1,000 times. Filtering the continuous recording creates artifacts only at the very beginning, and you can drop the first few seconds to eliminate them entirely.

**Consistency.** When a seizure crosses a window boundary, you want both windows to be filtered identically so the model sees a coherent signal. Filtering the full recording guarantees this. Filtering each window independently does not — the filter state resets between windows.

---

## 2. What is MNE?

MNE is a Python library specifically designed for neurophysiological data: EEG, MEG, ECoG, and ERP studies.

Think of it as:

| Domain | Library |
|---|---|
| Tabular data | Pandas |
| Images | OpenCV |
| Brain signals | MNE |

### What MNE handles that you'd never want to write yourself

- **EDF file parsing.** EDF is a binary format with multi-channel interleaving, headers, annotations, and per-channel calibration. MNE's `read_raw_edf()` handles all of this in one call.
- **Channel management.** Picking, dropping, renaming, and re-referencing channels with standard naming conventions.
- **Digital filters.** FIR filter design with linear phase response — preserves signal morphology without distortion, which is critical for seizure detection where waveform shape matters.
- **Unit handling.** Conversion between volts, microvolts, and raw ADC values.

### Key functions used in this project

| Function | Purpose |
|---|---|
| `mne.io.read_raw_edf(path, preload=True)` | Load entire EDF into RAM |
| `raw.pick_channels(channel_list)` | Keep only specified channels, drop the rest |
| `raw.filter(lowcut, highcut, fir_design="firwin")` | Bandpass filter |
| `raw.notch_filter(freqs=60.0)` | Remove power-line hum |
| `raw.get_data()` | Extract filtered signal as a numpy array |

---

## 3. The Architecture Stack

Every line of `inference.py` and `backend.py` lives in one of these layers:

| Layer | Technology | Input | Output | Responsibility |
|---|---|---|---|---|
| File I/O | MNE | `.edf` binary | `Raw` object | Parse EDF headers, channel names, sample data |
| Signal Processing | MNE | `Raw` object | NumPy `(n_chan, n_samples)` | Bandpass filter, notch filter, channel selection |
| Windowing | NumPy | Clean signal | `(n_windows, 22, 1792)` | Slice into 7s overlapping windows, pad to 22 channels |
| Normalization | NumPy | Windows | Normalized windows | Per-channel z-score using saved training stats |
| Inference | PyTorch | Tensor `(n_windows, 22, 1792)` | `(n_windows, 2)` logits | Conv1d layers extract features, FC layers classify |
| Post-processing | Python + NumPy | Logits | Seizure probabilities | Softmax → probability column → rank → filter by threshold |

### Why the separation matters

Each layer has exactly one responsibility. You can:

- Swap MNE for another EEG library without touching the normalization layer
- Test each layer independently with fake data
- Debug by checking the output shape at each boundary — if one layer produces wrong dimensions, the error is in that layer only

This is called **separation of concerns**. It's the difference between a notebook cell that does everything and a production system where each component can be tested, replaced, and understood in isolation.

---

## 4. What `score_windows()` Actually Does

The function takes preprocessed EEG windows and applies the same normalization statistics used during training. The normalized windows are converted into PyTorch tensors and passed through the CNN in inference mode using `torch.no_grad()`. The model outputs logits, which are converted into class probabilities using softmax. The seizure-class probability for each EEG window is then returned as a NumPy array.

### Logits

Logits are the raw, unbounded outputs from the model's final layer — before softmax. They look like `[3.2, -1.5]`.

- They are NOT probabilities. They don't sum to 1. They can be negative.
- A higher logit means stronger evidence for that class, but the scale is arbitrary.
- The model never directly predicts "seizure" or "normal" — it predicts two numbers whose relative sizes imply a decision.

### Softmax

Softmax converts logits to probabilities:

```
softmax(x_i) = e^x_i / sum(e^x_all)
```

Example:

```
Window A logits:  [2.1, -3.4]
e^2.1  = 8.17
e^-3.4 = 0.033
sum    = 8.20

normal_prob  = 8.17 / 8.20 = 0.996
seizure_prob = 0.033 / 8.20 = 0.004
```

```
Window B logits:  [-1.2, 4.5]
e^-1.2  = 0.30
e^4.5   = 90.02
sum     = 90.32

normal_prob  = 0.003
seizure_prob = 0.997
```

Softmax amplifies differences. A logit that's 5 points ahead becomes a ~99% probability. A close call (0.5 apart) becomes ~62% vs ~38%. This is why threshold tuning matters — the raw margin between logits determines whether a window is a borderline case (60% seizure) or an obvious one (99%).

### `torch.no_grad()`

During training, PyTorch builds a computation graph tracking every operation — multiplication, addition, activation — so it can compute gradients for backpropagation.

During inference, that graph is wasted memory and time. `torch.no_grad()` says "don't track anything — just compute forward and return the answer." Benefits:

- Less memory (no graph stored)
- Faster (no graph construction overhead)
- Explicit intent — reading the code, you know this block is inference-only

### Why `.cpu().numpy()`

GPU tensors don't support `.numpy()` directly. They must be moved to CPU first. NumPy arrays are needed because the final response is JSON — PyTorch tensors aren't JSON-serializable.

---

## 5. Loading Once vs Loading Per Request

### The problem with per-request loading

If `load_model()` ran inside the `/predict` endpoint, every uploaded `.edf` would trigger:

1. Rebuild the model architecture from scratch (Python object creation)
2. Load 300,000 weights from disk (~700 KB file read)
3. Load normalization stats from disk
4. Move everything to GPU

This wastes CPU on repeat work and adds latency to every request.

### The lifespan pattern

```python
@asynccontextmanager
async def lifespan(app):
    global model, train_mean, train_std, device
    model, train_mean, train_std, device = load_model("model/")
    yield
```

- `lifespan` runs **once** when the server starts
- The model object stays in RAM — all requests share the same instance
- Global variables in Python modules are shared across all requests in a FastAPI process
- Reading from the model (inference) is thread-safe — no locks needed
- The tradeoff: updating the model requires a server restart. For a clinical tool, this is by design — no hot-swapping during patient sessions

This pattern is called a **singleton service**: one instance, loaded once, shared forever.

---

## 6. FastAPI — What It Gives You For Free

### Route decorators are self-documenting

```python
@app.get("/health")
def health():
    return {"status": "ok"}
```

The URL, HTTP method, and function are colocated. No separate routing file. No XML config.

### Auto-validation

```python
@app.post("/predict")
async def predict(file: UploadFile, threshold: float = 0.70):
```

- `threshold: float` auto-validates the query parameter is a number
- If someone sends `?threshold=abc`, FastAPI returns HTTP 422 before any of your code runs
- No manual type-checking or error handling needed

### Auto-generated Swagger UI

Visit `http://localhost:8000/docs` and you get an interactive API documentation page. Every endpoint listed with its parameters, request body schema, and a "Try it out" button. No separate documentation work required.

### File uploads are handled

`UploadFile` handles multipart form data parsing, temporary file storage, and cleanup. You receive a file-like `.read()` object. Zero manual HTTP parsing.

### CORS is one-time config

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Three lines and any browser can call your API from any origin. Without CORS, the browser silently blocks cross-origin requests — no error message, just a blank page. This is essential when your React app (port 3000) calls your backend (port 8000).

---

## 7. HTTP Methods — GET vs POST

| | GET | POST |
|---|---|---|
| Purpose | "Give me information" | "Here's data — do something with it" |
| Has request body? | No | Yes |
| Has query parameters? | Optional (`?key=value`) | Optional |
| Bookmarkable? | Yes | No |
| Idempotent? | Yes (same request = same response) | No (upload twice = process twice) |
| Cached by browsers? | Yes | No |
| Used in this project | `/health` | `/predict` |

GET is for reading state. POST is for performing actions. `/predict` uses POST because uploading a file and running inference is an action — it consumes resources, produces a result, and shouldn't be cached or bookmarked.

---

## 8. The Model Is Useless Without Its Normalization Stats

### The problem

You cannot recompute `train_mean` and `train_std` from new data at inference time. The model learned patterns relative to the **training distribution**. Normalizing new data with new statistics changes the scale the model sees, and its learned weights stop making sense.

### Analogy

Your journal's measuring cup analogy: you bake a cake with a specific cup size. A new patient's EEG is a new bag of flour. If you measure it with a different cup, the recipe fails. Even if the flour looks identical.

### The silent failure

If you use wrong normalization stats, the model still runs. It still produces numbers between 0 and 1. They look like probabilities. They're wrong.

This is worse than a crash — a crash tells you something broke. Silent wrong outputs are indistinguishable from correct outputs. A doctor might trust them.

### The fix

Always package `train_mean.npy` and `train_std.npy` alongside the model weights and config. Ship the full recipe, not just the cake. Your `model/` folder should always contain all four files:

```
model/
  ├── eegcnn1d_weights.pth
  ├── model_config.json
  ├── train_mean.npy
  └── train_std.npy
```

---

## 9. Separating Functions from Endpoints

### The pattern

`process_edf()` is a pure function. It takes a file path, returns arrays. It knows nothing about HTTP, FastAPI, or request handling.

`@app.post("/predict")` is an endpoint. It handles HTTP concerns — parsing the file upload, validating the threshold query param, formatting the JSON response.

The endpoint **calls** the function. It does not **contain** it.

### Why this matters

Three concrete benefits:

1. **Testability.** You can test `process_edf()` by calling it with a local file path. No server needed. No `curl` needed. Just `process_edf("test.edf")` in a test script.

2. **Reusability.** `inference.py` and `backend.py` both call the same `process_edf()` logic. If you fix a bug in one, the other benefits automatically (if they share the code). Currently they duplicate it — a future refactor would extract shared logic into a `pipeline.py` module.

3. **Change isolation.** If you want to add a webhook notification after predicting, you edit the endpoint. If you want to change how filtering works, you edit the function. Neither change risks breaking the other.

This is **separation of concerns**: each piece of code owns exactly one job.


**READING ERROR**
┌─── (1) THE TYPE ──────────────────────────┐
│  ImportError: cannot import name           │
│  'asynccotextmanager' from 'contextlib'    │
└────────────────────────────────────────────┘

            Tells you WHAT went wrong.
            "ImportError" = something wrong with an import.
            "cannot import name X from Y" = X doesn't exist in Y.

┌─── (2) THE FIX ───────────────────────────┐
│  Did you mean: 'asynccontextmanager'?      │
└────────────────────────────────────────────┘

            Python GUESSES what you meant.
            Always read this line first — it's right 90% of the time.

┌─── (3) THE LOCATION ──────────────────────┐
│  File "backend.py", line 3                │
└────────────────────────────────────────────┘

            Tells you WHERE the error is.
            Line 3 of backend.py.
            The traceback shows the call stack from bottom to top —
            start reading from the bottom, find YOUR code.


