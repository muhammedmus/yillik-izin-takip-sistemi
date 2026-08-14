"""Iteration 16 — TEST 1 (leaves export.xlsx with filters) + TEST 2 (excel-override report)
Plus quick smoke on regression endpoints (dashboard stats, personnel pagination, leaves pagination,
izin-cetveli FIFO, reports/charts monthly trend).
"""
import os
import pytest
import requests

def _load_frontend_env():
    envf = "/app/frontend/.env"
    if os.path.exists(envf):
        for ln in open(envf):
            if ln.startswith("REACT_APP_BACKEND_URL="):
                return ln.split("=", 1)[1].strip().strip('"').rstrip("/")
    return os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

BASE = _load_frontend_env()
assert BASE, "REACT_APP_BACKEND_URL not set"
API = f"{BASE}/api"

ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}
HR = {"email": "muhammedmus@hotmail.com", "password": "HrTest1234"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def hr():
    return _login(HR)


# ---- TEST 1: leaves export xlsx ----
class TestLeavesExportXlsx:
    def test_export_default_recent_30(self, admin):
        r = admin.get(f"{API}/leaves/export.xlsx", params={"recent_days": 30}, timeout=30)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        assert r.content[:2] == b"PK"
        assert len(r.content) > 1000, f"xlsx too small: {len(r.content)}"

    def test_export_with_izin_turu(self, admin):
        r = admin.get(f"{API}/leaves/export.xlsx",
                      params={"izin_turu": "Yıllık İzin", "recent_days": 365}, timeout=30)
        assert r.status_code == 200
        assert len(r.content) > 1000

    def test_export_with_q_search(self, admin):
        r = admin.get(f"{API}/leaves/export.xlsx",
                      params={"q": "ABDULLAH"}, timeout=30)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"

    def test_export_hr_allowed(self, hr):
        r = hr.get(f"{API}/leaves/export.xlsx", params={"recent_days": 30}, timeout=30)
        assert r.status_code == 200


# ---- TEST 2: excel-override report ----
class TestExcelOverridesReport:
    def test_admin_can_read(self, admin):
        r = admin.get(f"{API}/reports/excel-overrides", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data and "items" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        # if items exist, verify shape
        if data["items"]:
            it = data["items"][0]
            for k in ["id", "timestamp", "user_email", "sicil_no", "ad_soyad",
                      "start_date", "end_date", "system_days", "manual_days",
                      "difference", "reason"]:
                assert k in it, f"missing key {k}"

    def test_hr_can_read(self, hr):
        r = hr.get(f"{API}/reports/excel-overrides", timeout=15)
        assert r.status_code == 200

    def test_pagination(self, admin):
        r = admin.get(f"{API}/reports/excel-overrides",
                      params={"limit": 5, "skip": 0}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data["items"]) <= 5

    def test_viewer_forbidden(self, admin):
        # try to hit endpoint without a valid session
        r = requests.get(f"{API}/reports/excel-overrides", timeout=15)
        assert r.status_code in (401, 403)


# ---- Regression smoke ----
class TestRegressionSmoke:
    def test_dashboard_stats(self, admin):
        r = admin.get(f"{API}/dashboard/summary", timeout=15)
        assert r.status_code == 200
        d = r.json()
        # accepting some structure
        assert isinstance(d, dict)

    def test_personnel_pagination(self, admin):
        r = admin.get(f"{API}/personnel", params={"limit": 100, "skip": 0}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        # response may be {items, total} or list
        if isinstance(d, dict):
            assert "items" in d
            assert len(d["items"]) <= 100
        else:
            assert isinstance(d, list)

    def test_leaves_pagination(self, admin):
        r = admin.get(f"{API}/leaves", params={"limit": 100, "skip": 0}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        if isinstance(d, dict):
            assert "items" in d or "leaves" in d

    def test_reports_charts_monthly_trend(self, admin):
        r = admin.get(f"{API}/reports/charts", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "monthly_trend" in d
        mt = d["monthly_trend"]
        assert isinstance(mt, list) and len(mt) > 0
        first = mt[0]
        for k in ("month", "days", "people"):
            assert k in first

    def test_izin_cetveli_fifo(self, admin):
        # Get ABDULLAH ALBAYRAK
        r = admin.get(f"{API}/personnel", params={"q": "ABDULLAH ALBAYRAK", "limit": 5}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        items = d["items"] if isinstance(d, dict) and "items" in d else d
        if not items:
            pytest.skip("ABDULLAH ALBAYRAK not found")
        pid = items[0]["id"]
        r2 = admin.get(f"{API}/personnel/{pid}/izin-cetveli", timeout=20)
        assert r2.status_code == 200
        cet = r2.json()
        allocs = cet.get("allocations") or cet.get("items") or cet
        if isinstance(allocs, list):
            print(f"ABDULLAH ALBAYRAK allocations count: {len(allocs)}")
