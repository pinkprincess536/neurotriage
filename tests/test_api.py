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


def test_feedback(client, mock_supabase):
    res = client.post("/login", json={"password": "test-doctor"})
    token = res.json()["token"]

    res = client.post("/feedback", json={
        "recording_id": 1,
        "timestamp_sec": 10.5,
        "score": 0.95,
        "label": "seizure",
    })
    assert res.status_code == 200
    assert res.json()["status"] == "saved"


def test_retrain_doctor_forbidden(client, doctor_token):
    res = client.post(
        "/retrain",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res.status_code == 403


def test_retrain_no_auth(client):
    res = client.post("/retrain")
    assert res.status_code == 403
