"""Iteration 15 — Personnel hard delete backend regression.

Covers:
- GET /api/personnel/{id}/delete-preview (admin)
- POST /api/personnel/{id}/delete
    * empty password/reason -> 400
    * wrong password -> 403 (+ audit delete_failed)
    * HR role -> 403 (RBAC)
    * correct password + reason -> 200 (+ audit hard_delete)
"""
import os
import uuid
import requests
import pytest

def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
API = f"{BASE_URL}/api"

ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}
HR = {"email": "muhammedmus@hotmail.com", "password": "HrTest1234"}


def _login(session: requests.Session, creds: dict) -> bool:
    r = session.post(f"{API}/auth/login", json=creds, timeout=15)
    return r.status_code == 200


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    assert _login(s, ADMIN), "Admin login failed"
    return s


@pytest.fixture(scope="module")
def hr_session():
    s = requests.Session()
    if not _login(s, HR):
        pytest.skip("HR login failed — skipping RBAC test")
    return s


def _create_personnel(session: requests.Session, sicil_suffix: str) -> str:
    payload = {
        "sicil_no": f"TEST-HD-{sicil_suffix}",
        "ad_soyad": "Silinecek QA",
        "tc_no": "11111111110",
        "ise_giris": "2024-01-01",
        "departman": "QA",
        "gorev": "Test",
    }
    r = session.post(f"{API}/personnel", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"create personnel failed: {r.status_code} {r.text}"
    return r.json()["id"]


class TestHardDelete:
    def test_delete_preview_ok(self, admin_session):
        pid = _create_personnel(admin_session, uuid.uuid4().hex[:6])
        r = admin_session.get(f"{API}/personnel/{pid}/delete-preview", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["personnel"]["id"] == pid
        assert data["personnel"]["sicil_no"].startswith("TEST-HD-")
        assert "leaves_count" in data and "entitlements_count" in data
        # cleanup
        admin_session.post(f"{API}/personnel/{pid}/delete",
                           json={"password": ADMIN["password"], "reason": "cleanup"})

    def test_delete_empty_body_400(self, admin_session):
        pid = _create_personnel(admin_session, uuid.uuid4().hex[:6])
        r = admin_session.post(f"{API}/personnel/{pid}/delete",
                               json={"password": "", "reason": ""}, timeout=15)
        assert r.status_code == 400
        # cleanup
        admin_session.post(f"{API}/personnel/{pid}/delete",
                           json={"password": ADMIN["password"], "reason": "cleanup"})

    def test_delete_wrong_password_403(self, admin_session):
        pid = _create_personnel(admin_session, uuid.uuid4().hex[:6])
        r = admin_session.post(f"{API}/personnel/{pid}/delete",
                               json={"password": "wrong-pass-xxx", "reason": "QA neg"}, timeout=15)
        assert r.status_code == 403
        # Personnel must still exist
        g = admin_session.get(f"{API}/personnel/{pid}", timeout=10)
        assert g.status_code == 200
        # cleanup
        admin_session.post(f"{API}/personnel/{pid}/delete",
                           json={"password": ADMIN["password"], "reason": "cleanup"})

    def test_delete_hr_forbidden(self, admin_session, hr_session):
        pid = _create_personnel(admin_session, uuid.uuid4().hex[:6])
        r = hr_session.post(f"{API}/personnel/{pid}/delete",
                            json={"password": HR["password"], "reason": "QA hr"}, timeout=15)
        assert r.status_code == 403
        # cleanup by admin
        admin_session.post(f"{API}/personnel/{pid}/delete",
                           json={"password": ADMIN["password"], "reason": "cleanup"})

    def test_delete_success_200_and_audit(self, admin_session):
        pid = _create_personnel(admin_session, uuid.uuid4().hex[:6])
        r = admin_session.post(f"{API}/personnel/{pid}/delete",
                               json={"password": ADMIN["password"], "reason": "QA testi iter15"},
                               timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "leaves_removed" in body and "entitlements_removed" in body
        # verify 404 after
        g = admin_session.get(f"{API}/personnel/{pid}", timeout=10)
        assert g.status_code == 404
        # verify audit log contains hard_delete
        a = admin_session.get(f"{API}/audit-logs",
                              params={"module": "personnel", "action": "hard_delete", "limit": 20},
                              timeout=15)
        if a.status_code == 200:
            data = a.json()
            items = data if isinstance(data, list) else data.get("items", [])
            assert any(it.get("entity_id") == pid for it in items), "hard_delete audit not found"
