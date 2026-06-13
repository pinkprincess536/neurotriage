import requests
import os

os.makedirs("test_data", exist_ok=True)

files = {
    "chb24_01.edf": "https://physionet-open.s3.amazonaws.com/chbmit/1.0.0/chb24/chb24_01.edf",
    "chb06_01.edf": "https://physionet-open.s3.amazonaws.com/chbmit/1.0.0/chb06/chb06_01.edf",
}

for name, url in files.items():
    path = os.path.join("test_data", name)
    if os.path.exists(path):
        print(f"{name}: already exists, skipping")
        continue
    print(f"Downloading {name}...")
    r = requests.get(url, stream=True)
    r.raise_for_status()
    with open(path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"{name}: {os.path.getsize(path) / 1e6:.1f} MB downloaded")