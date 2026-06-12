# Learning Journal — EEG Seizure Triage Project
everything ive learned so far while making this :)) feel free to read <3
---

## 1. Normalization (Z-Score Normalization)

### What is it?
Transforming data so every feature has mean=0 and standard deviation=1.

Formula: `X_normalized = (X - mean) / std`

### Why use it?
Raw numbers from different sources have different scales. Normalization puts everything on the same scale so the model learns patterns, not scale differences.

### Analogy
You're baking a cake by someone else's recipe. It says "2 cups of flour." If your measuring cup is a different size, the cake fails. `train_mean` and `train_std` are the cup size — use the same cup every time or the recipe breaks.

### What happens without it?
- Model can't generalize to new patients
- Channels with larger raw amplitudes dominate training
- Gradients become unstable

### Real-world applications
| Domain | What's normalized |
|--------|-------------------|
| EEG | Voltage amplitudes across channels/patients |
| Stock prices | Price changes (percentages, not raw dollars) |
| Face recognition | Brightness/contrast across photos |
| Voice assistants | Audio volume levels |
| Medical imaging (MRI/CT) | Pixel intensities across machines |
| Recommendation systems | User rating behavior (some give all 5s, some never do) |

### Critical rule
Always save the normalization stats from training. Apply the **same** stats at inference. Never recompute from new data.

---

## 2. Pipeline Persistence (Saving Everything)

### The problem
If you train a model but don't save the normalization stats, model weights, and config — you can never use it again. Kaggle/Colab sessions die and everything is lost.

### What must be saved after every run

| Artifact | File | Why |
|----------|------|-----|
| Model weights | `eegcnn1d_weights.pth` | To reload and run inference |
| Model config | `model_config.json` | To rebuild the same architecture |
| Test metrics | `test_metrics.json` | To compare runs over time |
| Norm mean | `train_mean.npy` | To normalize new EEG the same way |
| Norm std | `train_std.npy` | Same as above |
| Channel names | `channel_names.npy` | To match channels at inference |

### Checklist after a run
- [ ] Model weights downloaded before Kaggle session ends
- [ ] Config + metrics saved
- [ ] Norm stats saved alongside processed data
- [ ] Metrics recorded somewhere for comparison

---

## 3. DVC (Data Version Control)

### What is it?
DVC = Git for large files. Git tracks small `.dvc` metadata files; DVC stores the actual large files (`.npy`, `.edf`) in remote storage (Google Drive, S3, etc.).

### The right setup
- **Git (GitHub)**: tracks code + `.dvc` pointer files
- **DVC remote**: stores actual data blobs (Drive, S3, Kaggle Dataset)
- When someone clones the repo, they run `dvc pull` to download data

### The wrong setup (current)
- DVC runs in a separate `git init` inside Google Drive
- `.dvc` files never reach GitHub
- No one else can reproduce the pipeline

### Key commands
```bash
dvc add processed/*.npy      # Track data files
git add processed/*.dvc      # Commit pointers to Git
git commit -m "dataset v2"
dvc push                      # Upload data to remote
git push                      # Push pointers to GitHub
```

---

## 4. Normalization in Neural Networks

### Why neural networks need it

Two reasons:

**Fairness between inputs.** A neural network adds up numbers from all inputs. If input A sends ~200 and input B sends ~2, input A dominates every calculation — not because it matters more, but because its numbers are bigger. Normalization gives every input an equal starting voice.

**Speed and stability.** Neural networks learn through small corrections called gradients. If inputs are huge and uneven, gradients become wild:
- Too big → the model overshoots and never settles (like trying to tune a radio by spinning the dial as hard as you can)
- Too tiny → it learns nothing (like whispering directions to someone across a football field)

Normalized inputs around zero keep gradients steady and predictable.

### In your EEG project

**23 channels, unequal scales.** Your 1D CNN treats all 23 EEG channels equally, but physically they're not. Frontal channels might swing ±200 µV while temporal channels hover around ±30 µV. Without normalization, the loud channels drown out the quiet ones — the CNN learns "loud channel = important" instead of "seizure pattern = important."

**Patient mismatch at test time.** You train on chb01–chb11. Later, a doctor uploads chb24. That patient's raw voltages could be double or half what the model saw during training. Without the saved `train_mean`/`train_std`, the model sees alien numbers and can't recognize anything.

**Inference is blocked.** Right now your pipeline computes normalization stats and throws them away. When Phase 4 (FastAPI backend) arrives and a doctor uploads a recording, you have no way to normalize it. The entire deployed system is dead before it starts.

The fix: two extra `np.save()` lines in `preprocess.ipynb`.

---

## 5. Inference in ML Models

### Training vs Inference

| | Training | Inference |
|---|---|---|
| **When** | Past, offline | Present, real-time |
| **Data** | Labeled examples (seizure / non-seizure) | New, unseen data (unknown EEG) |
| **Goal** | Learn patterns and rules | Apply rules to make predictions |
| **Speed** | Hours or days (one-time) | Milliseconds to seconds (every time) |
| **Output** | A trained model file | A prediction (score, label, ranking) |

### Analogy

**Training** = studying for a driving test. You read the manual, practice, memorize signs. Takes weeks.

**Inference** = actually driving on the road. You see a stop sign and react instantly. You don't re-read the manual at every intersection.

> Training is the rehearsal. Inference is the performance. Without it, you're just a band that only practices in the garage.

### Real-life examples

| System | Training | Inference |
|--------|----------|-----------|
| **Gmail spam filter** | Trained on millions of emails labeled "spam" / "not spam" across years | Scans your new email the moment it arrives, decides in <1 second |
| **Phone face unlock** | Trained on millions of face images in a lab | Looks at your face every time you pick up your phone, decides instantly |
| **Netflix recommendations** | Trained on billions of watch-history events | Shows you suggestions the moment you open the app |
| **Google Translate** | Trained on millions of translated documents | Translates your sentence as you type |
| **Voice assistant (Siri/Alexa)** | Trained on thousands of hours of speech | Understands your "hey" command in real-time |

### In your EEG project

The full inference flow:

```
Doctor uploads recording (chb24, 1 hour of EEG)
        │
        ▼
Preprocessing  ─── slice into 5-second windows
        │
        ▼
Normalize  ─── using saved train_mean.npy / train_std.npy
        │
        ▼
Model (1D CNN)  ─── scores every window: 0.0 (normal) to 1.0 (seizure)
        │
        ▼
Rank & return  ─── top-N most seizure-like windows
        │
        ▼
Doctor reviews  ─── clicks "True seizure" or "Not a seizure"
        │
        ▼
Feedback stored  ─── used later to retrain and improve the model
```

Every step except the last two happens automatically in seconds. The doctor sees only the ranked segments — not 1 hour of raw EEG. That's the triage assistant.

Inference is the moment the system actually helps a doctor. Without it, the model is just a file sitting on a hard drive.

---

## 6. Threshold Tuning

### What is argmax?

`argmax` picks the index of the biggest number. Always. No exceptions.

```python
scores = [0.35, 0.65]      # [normal_score, seizure_score]
argmax  →  1               # index 1 is bigger (0.65 > 0.35)

scores = [0.88, 0.12]
argmax  →  0               # index 0 is bigger

scores = [0.49, 0.51]
argmax  →  1               # seizure — barely, but still seizure
```

It doesn't care about confidence. [0.49, 0.51] and [0.01, 0.99] produce the same answer: seizure. One is 51% sure, one is 99% sure. Same result.

### What is a model score?

Every window produces two numbers from the model: [normal_confidence, seizure_confidence]. The "score" is the second one — the seizure probability, from 0.0 to 1.0.

```
Window A:  [0.95, 0.05]  → 5% chance of seizure  → normal
Window B:  [0.49, 0.51]  → 51% chance of seizure → barely seizure
Window C:  [0.02, 0.98]  → 98% chance of seizure → almost certainly seizure
```

### What is threshold tuning?

Instead of the fixed argmax rule ("51% = seizure"), you set a custom bar:

```
"Only show me windows where seizure probability > 0.85"
```

| Threshold | What happens |
|-----------|-------------|
| 0.50 | Default argmax. Catches everything but lots of false alarms. |
| 0.80 | Fewer false alarms but might miss subtle seizures. |
| 0.95 | Almost no false alarms but misses many seizures. |

It's a slider — you trade one kind of error for another.

### The ML principle: Precision-Recall Tradeoff

There's no free lunch. As you catch more seizures (higher recall), you also flag more false alarms (lower precision). The threshold is where you pick your spot on that tradeoff.

It's also **cost-sensitive decision making**: not all errors are equal.

| Error | Cost |
|-------|------|
| Missed seizure (FN) | Patient harm. Catastrophic. |
| False alarm (FP) | Doctor wastes 10 seconds. Annoying. |

The threshold encodes this asymmetry. Missing a seizure is 1000x worse than a false alarm, so you might tolerate 50 false alarms per hour to guarantee you catch every seizure.

### In your EEG project

Current `train_eeg.ipynb` uses `argmax` — fixed at 0.50. With threshold tuning added:

1. After each training run, test multiple thresholds (0.50, 0.60, ..., 0.95)
2. For each threshold, calculate recall + false alarms per hour
3. Print a table so the doctor can pick their preferred balance
4. Store the chosen threshold in `model_config.json`
5. At inference time, use that threshold instead of argmax

### Three-tier triage (future)

Instead of one threshold, use three:

| Tier | Threshold | Meaning |
|------|-----------|---------|
| 🔴 Urgent | > 0.95 | Almost certainly seizure — look now |
| 🟡 Review | 0.50–0.95 | Might be seizure — review when possible |
| ⬜ Hidden | < 0.50 | Very likely normal — never shown |

The doctor skips straight to Red, confirms in seconds, then browses Yellow if time allows.

### False alarms per hour (FA/hr)

FA/hr is the clinical metric that matters. Accuracy on a balanced test set tells you nothing about real-world performance. FA/hr tells you how many wrong flags a doctor has to dismiss.

**How it's calculated:**

```python
window_sec = 7.0                  # each window = 7 seconds of EEG
stride_sec = 7.0 * (1 - 0.3)     # windows start every 4.9 seconds (30% overlap)
windows_per_hour = 3600 / 4.9    # ~735 windows per hour of EEG

fa_per_hour = (false_positives / total_windows) * windows_per_hour
```

Example: test set has 536 windows, 75 false positives:

```
75 / 536 * 735 = 103 false alarms per hour
```

That means the doctor has to dismiss ~103 normal windows every hour. At threshold 0.95, that drops to ~7. The tradeoff is how many real seizures you miss at that threshold.

This is the number that determines whether the triage assistant is actually usable in a clinic. A model with 95% accuracy but 200 FA/hr is useless — the doctor spends more time dismissing false alarms than reading raw EEG.

### The feedback loop connection

Every time the doctor clicks ✓ or ✗, the system stores the model score alongside the decision. Over time, it learns: "for this doctor, on this EEG machine, anything below 0.55 is always a false alarm." The thresholds auto-adjust.

---

## 7. Recall Drop on Realistic Test Set

The model's sensitivity fell from ~0.78 to ~0.57 at threshold 0.50 on an argmax evaluation. This is not degradation — it is the direct consequence of switching from a balanced test split to one that reflects the true class distribution of EEG data.

### The numbers

| | Old test set | New test set |
|---|---|---|
| Non-seizure windows | 500 | ~15,000+ |
| Seizure windows | 36 | ~36 |
| Non-seizure-to-seizure ratio | 14:1 | 400:1 |
| Test patients | 2 (chb04, chb07) | 12 patients |
| Seizure weight used | 5x-9x | 5x-9x |
| Model architecture | Same EEGCNN1D | Unchanged |
| Training data | 9 patients, 500 non-seizure | Unchanged |
| Recall at 0.50 | 0.78 | 0.57 |
| FA/hr at 0.50 | 5-40 | 38 |

### Why recall dropped

The model outputs a seizure probability p in [0, 1] for every window. At threshold 0.50, any window with p > 0.50 is classified as seizure. The model was trained on a balanced dataset where seizure and non-seizure windows appeared with equal frequency. In that setting, the decision boundary learned to separate the two classes with roughly equal error rates on both sides — because the training objective (weighted cross-entropy) and evaluation were operating on the same distribution.

The new test set has 400 non-seizure windows for every 1 seizure window. This introduces several effects:

1. **Boundary pressure from the negative class.** A 400:1 ratio means there are 400x more non-seizure windows near the decision boundary than seizure windows. The model must now discriminate against a far larger volume of normal EEG variations — sleep spindles, K-complexes, eye blink artifacts, muscle activity, electrode pops — any of which can produce activation patterns that partially overlap with seizure morphology in the learned feature space.

2. **Conservative probability estimates.** The softmax output is calibrated to the training distribution, not the test distribution. When the test distribution shifts heavily toward the negative class, the model's seizure probabilities become conservative — borderline windows that previously registered p approximately 0.55-0.65 now fall to p approximately 0.40-0.50 because the model sees more evidence of normality in the surrounding features. At threshold 0.50, these windows go from "seizure" to "normal" — reducing recall.

3. **The haystack analogy.** At 14:1, finding 36 seizure windows in 500 normal windows is like locating 36 red marbles in a jar of 500 blue ones — most are obviously different. At 400:1, it's 36 red marbles in a jar of 15,000 blue ones of varying shades — some blues look almost red under certain lighting. The model hesitates on the ambiguous ones, and those hesitations accumulate into lower recall.

### What this reveals about clinical deployment

The old recall of 0.78 was a mirage. It described performance on a test set that did not represent real EEG. Real EEG recordings are hours long with seizures occupying minutes. A model deployed on a balanced test set will overpromise and underdeliver in a clinic.

The new recall of 0.57 is lower but honest. It tells you: "on 12 unseen patients, with no threshold tuning, this model automatically catches 57% of seizure windows while generating 38 false alarms per hour." That is a clinically meaningful statement. A neurologist can decide whether 57% auto-catch + manual review of flagged windows is sufficient, or whether the model needs more training data, higher seizure weight, or architectural changes to push recall higher.

### What can improve it

| Intervention | Mechanism | Expected impact |
|---|---|---|
| Higher seizure weight (12x-20x) | Penalizes missed seizures more heavily, pushing the decision boundary toward the negative class | Higher recall at cost of higher FA/hr |
| More train patients | Currently 9 of 24. More patients = more diverse seizure morphologies in training | Better generalization to unseen seizure patterns |
| Unbalanced training | Train on the true distribution (1:400 ratio) with appropriate class weighting | Model learns to handle the natural imbalance directly |
| Threshold lowering (0.40, 0.30) | Accept lower confidence windows as seizure. Clinical decision, not a model change | Higher recall, higher FA/hr — doctor decides the tradeoff |

All four interventions operate on different levers: model training (weight, data), data strategy (balanced vs unbalanced), and clinical workflow (threshold). They are independent and can be combined.

### The key insight

The model did not get worse. The evaluation got honest. This is the moment the project moves from "looks good on paper" to "measures what it will actually do in a hospital."

---

## 8. Who the Model Trained On (And Why It Mattered)

### The split was lopsided

When the 24 patients were randomly shuffled with seed=42, the training set got 9 patients and the test set got 15. Only 6 patients in the whole dataset have seizures at all. The random shuffle put just 2 of them in training and 4 in testing.

The worst part: chb24 — the one patient where every single recording contains a seizure (12 out of 12) — ended up entirely in the test set. The model never saw anything like chb24 during training. Not one recording. Not one window.

Imagine teaching someone to spot counterfeit money using only slightly worn bills, then testing them on bills that are ripped, stained, and crumpled. They were never shown those patterns. They'd fail — not because they're bad at the task, but because the test is asking about something they were never taught.

### What was actually happening

| | Training (9 patients) | Testing (15 patients) |
|---|---|---|
| Patients with seizures | 2 (chb01, chb02) | 4 (chb03, chb04, chb05, chb24) |
| Seizure recordings seen | ~10 | ~26 |
| Hardest case | chb01 (7 seizures across 42 recordings) | chb24 (12 seizures, 12 recordings, 100% density) |

The test set was harder than the training set in every way. The model was being graded on a harder exam than what it studied for. That's not a fair test of the model — it's a test of whether the random shuffle gave me a reasonable split.

### Fixing the split

The plan: move the two most valuable seizure patients from test into training. chb24 (12 seizure recordings, the extreme case) and chb05 (5 seizure recordings, mid-range severity). In exchange, two non-seizure patients (chb10, chb12) move from training to test. The 9/15 balance stays the same.

| | Before | After |
|---|---|---|
| Train seizure patients | 2 | 4 (chb01, chb02, chb05, chb24) |
| Test seizure patients | 4 (including chb24) | 2 (chb03, chb04 only) |

Now training includes the full spectrum — from mild cases (chb02 with 3 recordings) to the extreme (chb24 with 12). The model studies a complete textbook instead of a thin pamphlet.

---

## 9. Finding the Right Seizure Weight

I tested weights from 5x up to 20x. The seizure weight controls how much the model is penalized for missing a seizure — higher weight means the model is more afraid of letting one slip by.

### What the experiments showed

| Weight | Test recall at threshold 0.50 | What happened |
|---|---|---|
| 5x | 0.44 | Too cautious. Misses over half of seizures |
| 8x | 0.58 | Starting to care more about catching seizures |
| 12x | 0.47–0.58 (varied a lot) | Getting into the useful range |
| **13x** | **0.38–0.61 (best single run)** | **The sweet spot sits around here** |
| 14x | 0.46 | Starting to wobble. Higher isn't always better |
| 20x | 0.25–0.38 | Complete collapse |

The model works best around 12x–13x weight. Below that, it's too relaxed about missing seizures — it says "probably normal" on ambiguous windows instead of flagging them. Above ~14x, the pendulum swings too far. At 20x, missing a seizure is penalized so heavily that the model's learning process breaks down entirely.

Think of it like adjusting shower temperature. Cold water = low weight — nothing happens. Warm = useful range. Too hot and you jump out. 20x is the point where the water scalds and you can't stand in it at all. The model's training becomes erratic — each batch of data sends the model overcorrecting in a new direction, and it never settles into a stable solution. Near-perfect training recall accompanied by terrible test recall is the smoking gun for this.

The key takeaway: higher seizure weight helps up to a point, then backfires catastrophically. The usable range is narrow (12–14x), and you can't just keep turning the dial.

---

## 10. Why Running Once Isn't Enough

### The same weight, same data, different result

I trained the model multiple times with the exact same weight, exact same data, exact same settings. The only difference was the random numbers used to set up the model's starting state before training began.

| Weight | Worst run (recall) | Best run (recall) | Gap |
|---|---|---|---|
| 12x | 0.25 | 0.58 | 33 points |
| 13x | 0.38 | 0.61 | 23 points |

A 23-point swing from one run to the next — with nothing changed except where the model started. That's not a bug. That's how neural networks work.

### The marble metaphor

Before training, every one of the model's 300,000 tiny connections gets a random number. It's like dropping a marble onto a mountain range with thousands of valleys. The marble rolls downhill — that's training. Where it ends up depends entirely on where I dropped it.

Drop the marble on a ridge, it might slide into a shallow dent and get stuck there — decent but not great (0.38 recall). Drop it on the slope of a deep valley, it rolls all the way to the bottom (0.61 recall). Same marble, same gravity — pure luck of the starting position.

### What this means practically

If I train the model once and get 0.61 recall, I don't know if that weight is genuinely good or if I just got lucky with the initialization. If I train it once and get 0.38, I don't know if the weight is bad or if I just started in a bad valley.

The fix: run each weight 3 times with different random starting positions, then average the results. A weight averaging 0.51 across three runs with a small spread between best and worst is more reliable than a weight that hit 0.61 once and 0.38 twice. Reliability matters more than single-run peak performance when picking a model for clinical use.

---

*Updated: June 2026*
