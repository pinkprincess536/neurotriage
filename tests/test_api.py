def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True


def test_login_doctor(client):
    res = client.post("/login", json={"password": "test-doctor"})
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "doctor"
    assert "token" in data


def test_login_admin(client):
    res = client.post("/login", json={"password": "test-admin"})
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "admin"
    assert "token" in data


def test_login_wrong_password(client):
    res = client.post("/login", json={"password": "wrong"})
    assert res.status_code == 401


def test_models_admin(client, admin_token):
    res = client.get("/models", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "active_version" in data
    assert "versions" in data
    assert len(data["versions"]) >= 1
    assert data["versions"][0]["version"] == "v1"


def test_models_doctor_forbidden(client, doctor_token):
    res = client.get("/models", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 403


def test_models_no_auth(client):
    res = client.get("/models")
    assert res.status_code == 403


def test_activate_admin(client, admin_token):
    res = client.post(
        "/models/activate",
        json={"version": "v1"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.json()["active_version"] == "v1"


def test_activate_invalid_version(client, admin_token):
    res = client.post(
        "/models/activate",
        json={"version": "v999"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400


def test_activate_doctor_forbidden(client, doctor_token):
    res = client.post(
        "/models/activate",
        json={"version": "v1"},
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res.status_code == 403


def test_feedback(client, doctor_token):
    res = client.post("/feedback", json={
        "recording_id": 1,
        "timestamp_sec": 10.5,
        "score": 0.95,
        "label": "seizure",
    }, headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "saved"


def test_feedback_no_auth(client):
    res = client.post("/feedback", json={
        "recording_id": 1,
        "timestamp_sec": 10.5,
        "score": 0.95,
        "label": "seizure",
    })
    assert res.status_code == 401


def test_patients_no_auth(client):
    assert client.get("/patients").status_code == 401


def test_patients_doctor_ok(client, doctor_token):
    res = client.get("/patients", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    assert "patients" in res.json()


def test_retrain_doctor_forbidden(client, doctor_token):
    res = client.post(
        "/retrain",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res.status_code == 403


def test_retrain_no_auth(client):
    res = client.post("/retrain")
    assert res.status_code == 403


def test_create_patient(client, doctor_token):
    res = client.post(
        "/patients",
        json={"name": "Test Patient"},
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res.status_code == 200
    assert "patient" in res.json()


def test_upload_no_auth(client):
    res = client.post(
        "/patients/1/upload",
        files={"file": ("test.edf", b"dummy", "application/octet-stream")},
    )
    assert res.status_code == 401


def test_upload(client, doctor_token, monkeypatch):
    import numpy as np
    import backend

    def fake_process_edf(path):
        windows = np.zeros((3, 22, 10), dtype=np.float32)
        timestamps = np.array([0.0, 4.9, 9.8])
        return windows, timestamps, 21.0

    def fake_score_windows(model, windows, train_mean, train_std, device):
        return np.array([0.99, 0.80, 0.10], dtype=np.float32)

    monkeypatch.setattr(backend, "process_edf", fake_process_edf)
    monkeypatch.setattr(backend, "score_windows", fake_score_windows)

    res = client.post(
        "/patients/1/upload",
        files={"file": ("test.edf", b"dummy", "application/octet-stream")},
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["recording_id"] == 1
    assert data["total_windows"] == 3
    assert data["flagged_windows"] == 2
    assert len(data["results"]) == 2
    assert data["results"][0]["tier"] == "urgent"
