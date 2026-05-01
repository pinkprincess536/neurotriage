import mne

file_path = "PATH_TO_YOUR_EDF_FILE"

raw = mne.io.read_raw_edf(file_path, preload=True)

print(raw)