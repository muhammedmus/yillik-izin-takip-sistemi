"""Iteration 7: Users & AuditLog backend tests."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://merkoteks-izin.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "muhammedmus@gmail.com"
ADMIN_PASSWORD = "Merkoteks2026!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def unique_email():
    # Use unique email per test-run to avoid 400s
    return f"qa.audit.{uuid.uuid4().hex[:8]}@example.com"


# ---------- Auth / login_failed audit ----------
def test_login_failed_creates_audit(admin_session):
    bad_email = f"nope.{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/login", json={"email": bad_email, "password": "wrong"})
    assert r.status_code == 401
    # Search audit-log for the failed login
    time.sleep(0.5)
    a = admin_session.get(f"{API}/audit-log", params={"action": "login_failed", "entity_name": bad_email, "limit": 5})
    assert a.status_code == 200
    data = a.json()
    assert data["total"] >= 1
    hit = data["items"][0]
    assert hit["success"] is False
    assert hit["module"] == "auth"
    assert "ip_address" in hit and "client_type" in hit


# ---------- Users CRUD + audit ----------
def test_create_user_persists_and_audits(admin_session, unique_email):
    payload = {
        "name": "QA Test Audit",
        "email": unique_email,
        "username": f"qa_audit_{uuid.uuid4().hex[:6]}",
        "role": "viewer",
        "departman": "Test",
        "aktif": True,
        "password": "Test1234",
        "aciklama": "created by pytest",
    }
    r = admin_session.post(f"{API}/users", json=payload)
    assert r.status_code == 200, r.text
    user = r.json()
    assert user["email"] == unique_email
    assert user["role"] == "viewer"
    assert "password_hash" not in user
    uid = user["id"]

    # Verify GET returns the user
    lst = admin_session.get(f"{API}/users").json()
    assert any(u["id"] == uid for u in lst)

    # Audit contains create record with masked password (should NOT be in new_values)
    a = admin_session.get(f"{API}/audit-log", params={"module": "users", "action": "create", "entity_id": uid})
    assert a.status_code == 200
    items = a.json()["items"]
    assert len(items) >= 1
    nv = items[0].get("new_values") or {}
    assert "password" not in nv and "password_hash" not in nv
    assert nv.get("email") == unique_email

    pytest.uid = uid  # stash for later tests
    pytest.user_email = unique_email


def test_update_user_role_audits_diff(admin_session):
    uid = pytest.uid
    r = admin_session.put(f"{API}/users/{uid}", json={"role": "hr"})
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "hr"

    a = admin_session.get(f"{API}/audit-log", params={"module": "users", "action": "update", "entity_id": uid, "limit": 5})
    items = a.json()["items"]
    assert len(items) >= 1
    latest = items[0]
    assert (latest.get("old_values") or {}).get("role") == "viewer"
    assert (latest.get("new_values") or {}).get("role") == "hr"


def test_reset_password_audit_scrubs(admin_session):
    uid = pytest.uid
    r = admin_session.post(f"{API}/users/{uid}/reset-password", json={"new_password": "Sifre1234"})
    assert r.status_code == 200
    a = admin_session.get(f"{API}/audit-log", params={"module": "users", "action": "reset_password", "entity_id": uid})
    items = a.json()["items"]
    assert len(items) >= 1
    # Ensure no cleartext password anywhere in serialized item
    dumped = str(items[0])
    assert "Sifre1234" not in dumped


def test_toggle_active_flips(admin_session):
    uid = pytest.uid
    r = admin_session.post(f"{API}/users/{uid}/toggle-active")
    assert r.status_code == 200
    state1 = r.json()["aktif"]
    r2 = admin_session.post(f"{API}/users/{uid}/toggle-active")
    assert r2.status_code == 200
    state2 = r2.json()["aktif"]
    assert state1 != state2
    # audit should have activate/deactivate records
    a = admin_session.get(f"{API}/audit-log", params={"module": "users", "entity_id": uid, "limit": 20})
    actions = [x["action"] for x in a.json()["items"]]
    assert "activate" in actions or "deactivate" in actions


def test_cannot_self_deactivate(admin_session):
    me = admin_session.get(f"{API}/auth/me").json()
    r = admin_session.post(f"{API}/users/{me['id']}/toggle-active")
    assert r.status_code == 400


def test_per_user_audit_log(admin_session):
    # Endpoint returns actions PERFORMED BY that user (acting user).
    # A brand-new user with no login yields 0 — that's expected & documented in spec.
    uid = pytest.uid
    r = admin_session.get(f"{API}/users/{uid}/audit-log")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data and "total" in data
    assert isinstance(data["items"], list)

    # Also test with admin (self) — must be > 0
    me = admin_session.get(f"{API}/auth/me").json()
    r2 = admin_session.get(f"{API}/users/{me['id']}/audit-log")
    assert r2.status_code == 200
    assert r2.json()["total"] >= 1


# ---------- Audit filters ----------
def test_audit_filter_by_module(admin_session):
    r = admin_session.get(f"{API}/audit-log", params={"module": "users", "limit": 50})
    assert r.status_code == 200
    for item in r.json()["items"]:
        assert item["module"] == "users"


def test_audit_filter_success_false(admin_session):
    r = admin_session.get(f"{API}/audit-log", params={"success": "false", "limit": 20})
    assert r.status_code == 200
    for item in r.json()["items"]:
        assert item["success"] is False


# ---------- Role-based access ----------
def test_audit_log_requires_admin():
    # Login as the HR/viewer test user we created above (after reactivating)
    email = pytest.user_email
    s = requests.Session()
    # Ensure test user is active
    admin = requests.Session()
    admin.headers.update({"Content-Type": "application/json"})
    login = admin.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    admin.headers.update({"Authorization": f"Bearer {login.json()['token']}"})
    # Re-activate & reset pw
    users = admin.get(f"{API}/users").json()
    u = next(x for x in users if x["email"] == email)
    if not u.get("aktif", True):
        admin.post(f"{API}/users/{u['id']}/toggle-active")
    admin.post(f"{API}/users/{u['id']}/reset-password", json={"new_password": "HrTest1234"})

    r = s.post(f"{API}/auth/login", json={"email": email, "password": "HrTest1234"})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})

    # HR user should get 403 on /audit-log and /users
    r2 = s.get(f"{API}/audit-log")
    assert r2.status_code == 403
    r3 = s.get(f"{API}/users")
    assert r3.status_code == 403


# ---------- If-Match PUT /personnel ----------
def test_personnel_ifmatch(admin_session):
    # pick an active personnel
    pl = admin_session.get(f"{API}/personnel", params={"aktif": "true"}).json()
    if not pl:
        pytest.skip("No active personnel to test If-Match")
    p = pl[0]
    updated_at = p.get("updated_at")
    body = {
        "sicil_no": p["sicil_no"],
        "ad_soyad": p["ad_soyad"],
        "ise_giris": p["ise_giris"],
        "departman": p.get("departman") or "",
        "sirket": p.get("sirket") or "",
        "unvan": p.get("unvan") or "",
        "aktif": p.get("aktif", True),
    }
    # matching updated_at → success
    headers = {"If-Match": updated_at} if updated_at else {}
    r = admin_session.put(f"{API}/personnel/{p['id']}", json=body, headers=headers)
    assert r.status_code == 200, r.text

    # stale updated_at → 412
    stale = "2000-01-01T00:00:00+00:00"
    r2 = admin_session.put(f"{API}/personnel/{p['id']}", json=body, headers={"If-Match": stale})
    # accept both 412 and 409 depending on impl
    assert r2.status_code in (412, 409), f"Expected 412/409 for stale If-Match, got {r2.status_code}"


# ---------- Cleanup: deactivate test user (do NOT physically delete) ----------
def test_zzz_cleanup_deactivate_created_user(admin_session):
    uid = getattr(pytest, "uid", None)
    if not uid:
        pytest.skip("no user created")
    users = admin_session.get(f"{API}/users").json()
    u = next((x for x in users if x["id"] == uid), None)
    if u and u.get("aktif"):
        admin_session.post(f"{API}/users/{uid}/toggle-active")
    # verify pasif
    users2 = admin_session.get(f"{API}/users").json()
    u2 = next((x for x in users2 if x["id"] == uid), None)
    assert u2 is not None
    assert u2.get("aktif") is False
