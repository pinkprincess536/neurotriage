import os
import sys
import json
import numpy as np
from dotenv import load_dotenv
from supabase import create_client

# Add parent directory to path to import eeg_core
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from eeg_core import extract_window_at_timestamp

def main():
    load_dotenv()
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in environmental variables.")
        sys.exit(1)
        
    print("Connecting to Supabase...")
    supabase = create_client(supabase_url, supabase_key)
    
    # 1. Fetch feedback records
    print("Fetching feedback table records...")
    fb_res = supabase.table("feedback").select("*").execute()
    feedback_records = fb_res.data
    if not feedback_records:
        print("No doctor feedback records found in Supabase. Cannot build dataset.")
        return
        
    print(f"Found {len(feedback_records)} feedback records.")
    
    # 2. Fetch recordings metadata for mapping
    print("Fetching recordings table records...")
    rec_res = supabase.table("recordings").select("*").execute()
    recordings_map = {r["id"]: r for r in rec_res.data}
    
    # Setup cache and data directories
    script_dir = os.path.dirname(__file__)
    cache_dir = os.path.join(script_dir, "cache")
    data_dir = os.path.join(script_dir, "data")
    os.makedirs(cache_dir, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)
    
    # Load normalization stats from model directory
    model_dir = os.path.join(script_dir, "../model")
    train_mean = np.load(os.path.join(model_dir, "train_mean.npy"))
    train_std = np.load(os.path.join(model_dir, "train_std.npy"))
    
    X_list = []
    y_list = []
    meta_records = []
    
    print("Downloading EDFs and extracting windows...")
    for idx, fb in enumerate(feedback_records, 1):
        rec_id = fb.get("recording_id")
        rec = recordings_map.get(rec_id)
        if not rec:
            print(f"[{idx}/{len(feedback_records)}] Warning: Recording ID {rec_id} not found in recordings table. Skipping.")
            continue
            
        storage_path = rec.get("storage_path")
        filename = rec.get("filename")
        if not storage_path:
            print(f"[{idx}/{len(feedback_records)}] Warning: No storage path for recording {rec_id}. Skipping.")
            continue
            
        # Download file to cache
        local_path = os.path.join(cache_dir, f"{rec_id}_{filename}")
        if not os.path.exists(local_path):
            print(f"[{idx}/{len(feedback_records)}] Downloading {filename} from Supabase Storage...")
            try:
                file_bytes = supabase.storage.from_("eeg-recordings").download(storage_path)
                with open(local_path, "wb") as f:
                    f.write(file_bytes)
            except Exception as e:
                print(f"Error downloading {filename}: {e}")
                continue
        else:
            print(f"[{idx}/{len(feedback_records)}] Using cached file for {filename}")
            
        # Extract window
        timestamp_sec = fb.get("timestamp_sec")
        label = fb.get("doctor_label")
        score = fb.get("model_score")
        
        try:
            window = extract_window_at_timestamp(local_path, timestamp_sec, train_mean, train_std)
            # label mapping: seizure -> 1, normal -> 0
            label_val = 1 if label == "seizure" else 0
            
            X_list.append(window)
            y_list.append(label_val)
            meta_records.append({
                "feedback_id": fb.get("id"),
                "recording_id": rec_id,
                "filename": filename,
                "timestamp_sec": timestamp_sec,
                "model_score": score,
                "doctor_label": label,
                "label_val": label_val,
                "model_version": fb.get("model_version", "v1")
            })
        except Exception as e:
            print(f"Error extracting window from {filename} at {timestamp_sec}s: {e}")
            continue

    if not X_list:
        print("No windows successfully extracted. Exiting.")
        return
        
    X_fb = np.array(X_list, dtype=np.float32)
    y_fb = np.array(y_list, dtype=np.int64)
    
    print(f"Extracted {X_fb.shape[0]} windows from feedback (Shape: {X_fb.shape}).")
    
    # Save feedback dataset
    np.save(os.path.join(data_dir, "feedback_X.npy"), X_fb)
    np.save(os.path.join(data_dir, "feedback_y.npy"), y_fb)
    
    with open(os.path.join(data_dir, "feedback_meta.jsonl"), "w") as f:
        for r in meta_records:
            json.dump(r, f)
            f.write("\n")
            
    print("Saved feedback dataset to ml/data/")
    
    # 3. Check for CHB-MIT baseline data to merge
    baseline_X_path = None
    baseline_y_path = None
    
    # Check current workspace paths
    possible_paths = [
        ("processed/X_train.npy", "processed/y_train.npy"),
        ("../processed/X_train.npy", "../processed/y_train.npy"),
    ]
    for px, py in possible_paths:
        if os.path.exists(px) and os.path.exists(py):
            baseline_X_path = px
            baseline_y_path = py
            break
            
    if baseline_X_path and baseline_y_path:
        print(f"Loading baseline dataset from {baseline_X_path}...")
        X_base = np.load(baseline_X_path)
        y_base = np.load(baseline_y_path)
        
        # Merge datasets
        X_merged = np.concatenate([X_base, X_fb], axis=0)
        y_merged = np.concatenate([y_base, y_fb], axis=0)
        
        np.save(os.path.join(data_dir, "merged_X.npy"), X_merged)
        np.save(os.path.join(data_dir, "merged_y.npy"), y_merged)
        print(f"Merged baseline + feedback dataset saved (Shape: {X_merged.shape}).")
    else:
        print("Note: No baseline training files found locally. Retrain training dataset will consist of feedback labels only.")
        np.save(os.path.join(data_dir, "merged_X.npy"), X_fb)
        np.save(os.path.join(data_dir, "merged_y.npy"), y_fb)

if __name__ == "__main__":
    main()
