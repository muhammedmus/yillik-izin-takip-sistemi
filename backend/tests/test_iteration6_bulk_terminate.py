"""
Iteration 6 backend regression tests.
Focus: /api/leaves/bulk/preview, /api/leaves/bulk (dry, all/department targets),
       PUT /api/personnel with aktif=false + isten_cikis (İşten Ayrılış Yap),
       /api/leaves/calendar not shadowed.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://merkoteks-izin.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "muhammedmus@gmail.com"
ADMIN_PASSWORD = "Merkoteks2026!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def test_login_me(session):
    r = session.get(f"{BASE_URL}/api/auth/me", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d.get("email") == ADMIN_EMAIL


def test_calendar_not_shadowed(session):
    r = session.get(f"{BASE_URL}/api/leaves/calendar", params={"year": 2026, "month": 5}, timeout=15)
    assert r.status_code == 200, f"calendar returned {r.status_code}: {r.text[:200]}"
    d = r.json()
    assert "days" in d


def test_bulk_preview_all(session):
    body = {
        "target": {"type": "all"},
        "start_date": "2026-05-04",
        "end_date": "2026-05-06",
        "izin_turu": "Yıllık İzin",
        "aciklama": "",
    }
    r = session.post(f"{BASE_URL}/api/leaves/bulk/preview", json=body, timeout=20)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) >= 1
    row = rows[0]
    for k in ["personnel_id", "ad_soyad", "computed_days", "remaining_after", "warnings", "can_apply"]:
        assert k in row


def test_bulk_preview_department_invalid(session):
    body = {
        "target": {"type": "department", "department": ""},
        "start_date": "2026-05-04",
        "end_date": "2026-05-06",
        "izin_turu": "Yıllık İzin",
    }
    r = session.post(f"{BASE_URL}/api/leaves/bulk/preview", json=body, timeout=15)
    assert r.status_code == 400


def test_bulk_preview_bad_date_range(session):
    body = {
        "target": {"type": "all"},
        "start_date": "2026-05-10",
        "end_date": "2026-05-04",
        "izin_turu": "Yıllık İzin",
    }
    r = session.post(f"{BASE_URL}/api/leaves/bulk/preview", json=body, timeout=15)
    assert r.status_code == 400


def test_terminate_and_reactivate_personnel(session):
    # Find an active personnel
    r = session.get(f"{BASE_URL}/api/personnel", timeout=15)
    assert r.status_code == 200
    people = r.json()
    active = [p for p in people if p.get("aktif")]
    assert active, "No active personnel to terminate"
    p = active[-1]  # take last to avoid interfering with primary users
    pid = p["id"]
    original_aciklama = p.get("aciklama", "") or ""

    # Terminate — send full personnel body
    payload = {**p}
    payload.pop("id", None)
    payload["aktif"] = False
    payload["isten_cikis"] = "2026-05-15"
    payload["aciklama"] = (original_aciklama + "\n[TEST_TERMINATE]").strip()
    r2 = session.put(f"{BASE_URL}/api/personnel/{pid}", json=payload, timeout=15)
    assert r2.status_code == 200, r2.text
    updated = r2.json()
    assert updated.get("aktif") is False
    assert updated.get("isten_cikis") == "2026-05-15"

    # Verify persistence via GET
    r3 = session.get(f"{BASE_URL}/api/personnel/{pid}", timeout=10)
    assert r3.status_code == 200
    assert r3.json().get("aktif") is False

    # Reactivate to cleanup
    reactivate = {**p}
    reactivate.pop("id", None)
    reactivate["aktif"] = True
    reactivate["isten_cikis"] = None
    reactivate["aciklama"] = original_aciklama
    r4 = session.put(f"{BASE_URL}/api/personnel/{pid}", json=reactivate, timeout=15)
    assert r4.status_code == 200
    assert r4.json().get("aktif") is True


def test_reports_endpoint_department(session):
    # Department-based reports must still work; personel-based UI removed but backend may still have it
    r = session.get(f"{BASE_URL}/api/reports/departments", timeout=15)
    # This endpoint may or may not exist; only assert not 500
    assert r.status_code in (200, 404)
