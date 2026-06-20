"""SQLite persistence for patients, recordings, and doctor feedback."""
import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.environ.get("EEG_DB_PATH", "eeg.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs("data/edfs", exist_ok=True)
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS recordings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL REFERENCES patients(id),
                filename TEXT,
                edf_path TEXT NOT NULL,
                duration_sec REAL,
                model_version TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id INTEGER NOT NULL REFERENCES recordings(id),
                timestamp_sec REAL NOT NULL,
                model_score REAL,
                doctor_label TEXT NOT NULL,
                model_version TEXT,
                created_at TEXT NOT NULL
            );
            """
        )


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def create_patient(name: str) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO patients (name, created_at) VALUES (?, ?)",
            (name, utc_now()),
        )
        pid = cur.lastrowid
        row = conn.execute("SELECT * FROM patients WHERE id = ?", (pid,)).fetchone()
        return dict(row)


def list_patients() -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT p.*, COUNT(r.id) AS recording_count "
            "FROM patients p LEFT JOIN recordings r ON r.patient_id = p.id "
            "GROUP BY p.id ORDER BY p.id DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def get_patient(patient_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
        return dict(row) if row else None


def create_recording(patient_id: int, filename: str, edf_path: str, duration_sec: float, model_version: str) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO recordings (patient_id, filename, edf_path, duration_sec, model_version, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (patient_id, filename, edf_path, duration_sec, model_version, utc_now()),
        )
        rid = cur.lastrowid
        row = conn.execute("SELECT * FROM recordings WHERE id = ?", (rid,)).fetchone()
        return dict(row)


def get_recording(recording_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,)).fetchone()
        return dict(row) if row else None


def add_feedback(recording_id: int, timestamp_sec: float, model_score: float, doctor_label: str, model_version: str) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO feedback (recording_id, timestamp_sec, model_score, doctor_label, model_version, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (recording_id, timestamp_sec, model_score, doctor_label, model_version, utc_now()),
        )
        fid = cur.lastrowid
        row = conn.execute("SELECT * FROM feedback WHERE id = ?", (fid,)).fetchone()
        return dict(row)


def count_feedback() -> int:
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) AS c FROM feedback").fetchone()
        return row["c"]


def list_feedback_with_recordings() -> list:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT f.*, r.edf_path, r.filename
            FROM feedback f
            JOIN recordings r ON r.id = f.recording_id
            ORDER BY f.id
            """
        ).fetchall()
        return [dict(r) for r in rows]
