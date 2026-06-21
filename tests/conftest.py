import os

os.environ["SUPABASE_URL"] = "https://fake.supabase.co"
os.environ["SUPABASE_KEY"] = "fake-key"
os.environ["DOCTOR_PASSWORD"] = "test-doctor"
os.environ["ADMIN_PASSWORD"] = "test-admin"

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def mock_supabase():
    mock = MagicMock()
    mock.storage.create_bucket.return_value = None
    mock.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": 1}])
    mock.table.return_value.select.return_value.order.return_value.execute.return_value = MagicMock(data=[])
    return mock


@pytest.fixture(scope="session")
def client(mock_supabase):
    with patch("backend.create_client", return_value=mock_supabase):
        from backend import app
        with TestClient(app) as c:
            yield c


@pytest.fixture()
def admin_token(client):
    res = client.post("/login", json={"password": "test-admin"})
    return res.json()["token"]


@pytest.fixture()
def doctor_token(client):
    res = client.post("/login", json={"password": "test-doctor"})
    return res.json()["token"]
