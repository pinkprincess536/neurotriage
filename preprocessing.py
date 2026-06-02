"""
EEG Seizure Detection — Reusable Preprocessing Pipeline
========================================================

This module provides the core building blocks for turning raw .edf EEG recordings
into labeled spectrogram datasets, ready for CNN training.

Pipeline order (each step is a reusable function):
  1. Load .edf file (MNE)
  2. bandpass_filter()      — filter full recording ONCE before windowing
  3. create_windows()       — slice into overlapping time windows
  4. create_labels()        — assign 0/1 labels based on seizure annotations
  5. create_spectrograms()  — convert windows to frequency-domain spectrograms
  6. process_recording()    — orchestrator that chains 1→5 for a single file

Why filter BEFORE windowing:
  - Applying a bandpass filter introduces edge artifacts at window boundaries.
    Filtering the full recording once avoids per-window artifacts and is faster.
  - This matches how a neurologist looks at EEG — the signal is already clean
    before you decide which segments to inspect.

Why 30% overlap (not 50%):
  - 50% overlap creates more windows, but many are highly redundant (adjacent
    windows share 50% of their samples). This increases dataset size without
    adding much new information.
  - 30% overlap balances coverage (no large gaps between windows) with
    efficiency (fewer redundant windows to compute spectrograms for).
  - For a 7-second window at 256 Hz: stride = 1792 * (1 - 0.3) = 1254 samples,
    meaning each window shares ~30% of its samples with neighbors.
"""

import re
import numpy as np
from scipy.signal import spectrogram


# ---------------------------------------------------------------------------
# STEP 1: Parse seizure annotations from CHB-MIT summary files
# ---------------------------------------------------------------------------

def parse_seizure_summary(summary_path):
    """
    Parse a CHB-MIT summary.txt file into seizure intervals.

    The CHB-MIT dataset provides one summary file per patient that lists:
      - Which files contain seizures
      - Start/end times (in seconds) for each seizure

    Arguments:
      summary_path : str — path to e.g. 'chb01-summary.txt'

    Returns:
      dict — {
          'chb01_15.edf': [(1732, 1772)],   # 1 seizure: starts at 1732s, ends at 1772s
          'chb01_03.edf': [(2996, 3036)],   # 1 seizure
          'chb01_17.edf': [],               # no seizures (non-seizure recording)
          ...
      }

    Intuition:
      We need to know EXACTLY when seizures happen so we can label each window
      as seizure (1) or non-seizure (0). The summary file is the ground truth.
    """
    with open(summary_path, 'r') as f:
        content = f.read()

    # Split the file into sections, one per EDF recording
    # Each section starts with "File Name: some_file.edf"
    sections = re.split(r'File Name:\s*', content)[1:]

    seizure_map = {}

    for section in sections:
        # Extract filename (first word of the section)
        filename_match = re.match(r'(\S+)', section)
        if not filename_match:
            continue
        filename = filename_match.group(1)

        # Extract all "Seizure Start Time: X seconds" entries
        starts = [
            int(s)
            for s in re.findall(r'Seizure\s+Start\s+Time:\s*(\d+)\s*seconds', section)
        ]
        # Extract all "Seizure End Time: X seconds" entries
        ends = [
            int(s)
            for s in re.findall(r'Seizure\s+End\s+Time:\s*(\d+)\s*seconds', section)
        ]

        # Pair starts with ends → list of (start, end) tuples
        intervals = list(zip(starts, ends))
        seizure_map[filename] = intervals

    return seizure_map


# ---------------------------------------------------------------------------
# STEP 2: Bandpass + notch filter the FULL recording
# ---------------------------------------------------------------------------

def bandpass_filter(raw, lowcut=0.5, highcut=40.0, notch_freq=60.0):
    """
    Apply bandpass + notch filter to the full EEG recording using MNE.

    This is called ONCE per recording, BEFORE windowing. This avoids per-window
    filter artifacts and is significantly faster than filtering each window.

    Arguments:
      raw       : mne.io.Raw — loaded .edf data (must be preloaded)
      lowcut    : float — lower cutoff frequency in Hz (default 0.5 Hz)
      highcut   : float — upper cutoff frequency in Hz (default 40 Hz)
      notch_freq: float — powerline frequency to notch out (default 60 Hz)

    Returns:
      np.ndarray — filtered signal, shape (n_channels, n_samples)

    Intuition:
      - Bandpass (0.5–40 Hz): Removes DC drift (<0.5 Hz) and muscle/EMG noise (>40 Hz).
        EEG seizure activity lives primarily in the 0.5–40 Hz range.
      - Notch (60 Hz): Removes electrical interference from power lines.
        This is specific to the US; use 50 Hz in Europe.
      - Filtering BEFORE windowing means each window inherits clean data without
        edge artifacts that would occur if you filtered each window individually.
    """
    # Make a copy so we don't modify the original MNE object
    raw_filtered = raw.copy()

    # Bandpass filter: keep frequencies between lowcut and highcut
    raw_filtered.filter(lowcut, highcut, fir_design='firwin', verbose=False)

    # Notch filter: remove powerline interference at 60 Hz
    raw_filtered.notch_filter(freqs=notch_freq, verbose=False)

    # Convert to numpy array: shape (n_channels, n_samples)
    return raw_filtered.get_data()


# ---------------------------------------------------------------------------
# STEP 3: Create sliding time windows
# ---------------------------------------------------------------------------

def create_windows(signal, sfreq, window_size_sec=7.0, overlap=0.3):
    """
    Slice a filtered EEG signal into overlapping time windows.

    This is the fundamental unit of analysis: the model sees one window at a time
    and predicts whether it contains a seizure.

    Arguments:
      signal          : np.ndarray — filtered signal, shape (n_channels, n_samples)
      sfreq           : float — sampling frequency in Hz
      window_size_sec : float — window duration in seconds (default 7.0)
      overlap         : float — overlap ratio, 0.0 to 1.0 (default 0.3 = 30%)

    Returns:
      np.ndarray — windows, shape (n_windows, n_channels, window_samples)

    Intuition:
      Seizures last from seconds to minutes. A 7-second window is long enough
      to capture seizure patterns but short enough to localize them precisely.
      The overlap ensures we don't miss seizures that fall near window boundaries.

      Example: 7s window at 256 Hz → 1792 samples per window.
              30% overlap → stride = 1792 * (1 - 0.3) = 1254 samples.
              Each window advances ~4.9 seconds from the previous one.
    """
    window_samples = int(window_size_sec * sfreq)
    stride = int(window_samples * (1 - overlap))
    total_samples = signal.shape[1]

    windows = []
    for start in range(0, total_samples - window_samples, stride):
        end = start + window_samples
        windows.append(signal[:, start:end])

    return np.array(windows)


# ---------------------------------------------------------------------------
# STEP 4: Label each window (seizure = 1, non-seizure = 0)
# ---------------------------------------------------------------------------

def create_labels(windows, sfreq, seizure_intervals):
    """
    Assign binary labels to each window based on seizure annotations.

    A window is labeled as seizure (1) if ANY part of it overlaps with a
    known seizure interval. Otherwise, it's labeled as non-seizure (0).

    Arguments:
      windows           : np.ndarray — shape (n_windows, n_channels, n_samples)
      sfreq             : float — sampling frequency
      seizure_intervals : list of tuples — [(start_sec, end_sec), ...]
                          Empty list → recording has no seizures → all labels = 0

    Returns:
      np.ndarray — labels, shape (n_windows,), dtype int

    Intuition:
      We use "soft" labeling: if even 1 sample of a window falls within a seizure,
      the whole window is labeled positive. This ensures we don't miss partial
      seizure events. The alternative ("hard" labeling, requiring >50% overlap)
      would discard windows that are 49% seizure — which is clinically important.
    """
    n_windows = windows.shape[0]
    window_samples = windows.shape[2]
    labels = np.zeros(n_windows, dtype=int)

    # If no seizures in this recording, all labels stay 0
    if not seizure_intervals:
        return labels

    # For each window, compute its start/end time in seconds
    # Window i starts at sample i * stride (where stride = window_samples * 0.7)
    stride = int(window_samples * (1 - 0.3))

    for i in range(n_windows):
        start_sec = (i * stride) / sfreq
        end_sec = (i * stride + window_samples) / sfreq

        # Check overlap with each seizure interval
        for seizure_start, seizure_end in seizure_intervals:
            if end_sec >= seizure_start and start_sec <= seizure_end:
                labels[i] = 1
                break  # No need to check other intervals once we know it's seizure

    return labels


# ---------------------------------------------------------------------------
# STEP 5: Convert windows to spectrograms
# ---------------------------------------------------------------------------

def create_spectrograms(windows, sfreq, channel_idx=0):
    """
    Convert EEG time-domain windows into spectrograms (frequency domain).

    A spectrogram shows how much energy exists at each frequency over time.
    CNNs treat spectrograms like images — learning to recognize visual patterns
    that distinguish seizure from non-seizure activity.

    NOTE: No filtering happens here. Filtering is done ONCE before windowing
    (see bandpass_filter). This function only transforms the time→frequency domain.

    Arguments:
      windows     : np.ndarray — shape (n_windows, n_channels, n_samples)
      sfreq       : float — sampling frequency in Hz
      channel_idx : int — which EEG channel to use (default 0 = FP1-F7)

    Returns:
      np.ndarray — spectrograms, shape (n_windows, n_freqs, n_time_bins)

    Intuition:
      - Raw EEG is a 1D signal over time (amplitude vs time).
      - A spectrogram converts this into a 2D image (frequency vs time, color = power).
      - Seizures often show characteristic frequency patterns (e.g., spike-wave
        complexes in the 3–4 Hz range). A CNN can learn to detect these.
      - We use only the first channel for simplicity, but you could extend this
        to use all channels (e.g., as separate channels like RGB).
    """
    spectrograms = []

    for window in windows:
        # Extract the chosen channel
        signal = window[channel_idx]

        # Convert to spectrogram using scipy
        # nfft=256 gives 129 frequency bins (256/2 + 1)
        # nperseg=256 balances time vs frequency resolution
        frequencies, times, Sxx = spectrogram(
            signal,
            fs=sfreq,
            nperseg=256,
            noverlap=128
        )

        spectrograms.append(Sxx)

    return np.array(spectrograms)


# ---------------------------------------------------------------------------
# STEP 6: Orchestrator — process a single recording end-to-end
# ---------------------------------------------------------------------------

def process_recording(edf_path, seizure_intervals,
                      window_size_sec=7.0, overlap=0.3,
                      lowcut=0.5, highcut=40.0, notch_freq=60.0,
                      channel_idx=0):
    """
    Process a single .edf recording through the full pipeline:
      Load → Filter → Window → Label → Spectrogram

    This is the main entry point. Call it once per recording file.

    Arguments:
      edf_path          : str — path to .edf file
      seizure_intervals : list — [(start_sec, end_sec), ...] for this recording
      window_size_sec   : float — window duration
      overlap           : float — overlap ratio (default 0.3 = 30%)
      lowcut, highcut   : float — bandpass cutoff frequencies
      notch_freq        : float — powerline notch frequency
      channel_idx       : int — EEG channel to use for spectrograms

    Returns:
      spectrograms : np.ndarray — shape (n_windows, n_freqs, n_time_bins)
      labels       : np.ndarray — shape (n_windows,), binary

    Intuition:
      This function chains the pipeline we designed above. Keeping these as
      separate functions (rather than one monolithic block) means we can:
        - Test each step independently
        - Reuse steps in different combinations
        - Change parameters without touching other stages
    """
    import mne  # Lazy import — only needed at runtime

    # 1. Load the raw EEG data
    raw = mne.io.read_raw_edf(edf_path, preload=True, verbose=False)

    # 2. Filter the full recording ONCE (before windowing)
    signal = bandpass_filter(raw, lowcut=lowcut, highcut=highcut,
                             notch_freq=notch_freq)

    sfreq = raw.info['sfreq']

    # 3. Slice into overlapping windows
    windows = create_windows(signal, sfreq,
                             window_size_sec=window_size_sec,
                             overlap=overlap)

    # 4. Label each window
    labels = create_labels(windows, sfreq, seizure_intervals)

    # 5. Convert to spectrograms
    spectrograms = create_spectrograms(windows, sfreq,
                                       channel_idx=channel_idx)

    return spectrograms, labels
