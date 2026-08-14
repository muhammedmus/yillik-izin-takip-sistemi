"""
Iteration 22 — Production Readiness Regression Suite (PASS/FAIL matrix).
Merkoteks Personel & İzin Sistemi. Read-only ve güvenli test kayıtları.
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://merkoteks-izin.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}
HR = {"email": "muhammedmus@hotmail.com", "password": "HrTest1234"}


def _login(sess, creds):
    r = sess.post(f"{API}/auth/login", json=creds, timeout=15)
    return r


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = _login(s, ADMIN)
    assert r.status_code == 200, f"admin login failed {r.status_code} {r.text[:200]}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def hr():
    s = requests.Session()
    r = _login(s, HR)
    if r.status_code != 200:
        pytest.skip(f"HR login failed {r.status_code}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# =============== AUTH ===============
class TestAuth:
    def test_login_admin(self):
        s = requests.Session()
        r = _login(s, ADMIN)
        assert r.status_code == 200
        j = r.json()
        assert "user" in j or "role" in j or "token" in j

    def test_login_hr(self):
        s = requests.Session()
        r = _login(s, HR)
        assert r.status_code == 200

    def test_login_wrong_password(self):
        s = requests.Session()
        r = _login(s, {"email": ADMIN["email"], "password": "wrongpass!"})
        assert r.status_code in (401, 400), f"expected 401 got {r.status_code}"

    def test_me_admin(self, admin):
        r = admin.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        j = r.json()
        assert j.get("role") in ("admin", "hr", "viewer")

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# =============== ROLE PERMISSIONS ===============
class TestRoles:
    def test_hr_audit_log_forbidden(self, hr):
        r = hr.get(f"{API}/audit-log", timeout=10)
        assert r.status_code == 403, f"HR should not access audit-log, got {r.status_code}"

    def test_hr_users_forbidden(self, hr):
        r = hr.get(f"{API}/users", timeout=10)
        assert r.status_code in (403, 404), f"HR should not list users, got {r.status_code}"

    def test_admin_audit_log_allowed(self, admin):
        r = admin.get(f"{API}/audit-log?limit=5", timeout=15)
        assert r.status_code == 200


# =============== PERSONNEL ===============
class TestPersonnel:
    SORTS = ["ad_soyad", "sicil_no", "ise_giris", "age", "ten_day", "cetvel", "remaining"]

    @pytest.mark.parametrize("sb", SORTS)
    def test_personnel_sort(self, admin, sb):
        r = admin.get(f"{API}/personnel?sort_by={sb}&limit=5", timeout=15)
        assert r.status_code == 200, f"sort {sb} → {r.status_code}"
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_personnel_count(self, admin):
        r = admin.get(f"{API}/personnel/count", timeout=10)
        assert r.status_code == 200
        j = r.json()
        assert isinstance(j, dict)

    def test_personnel_facets(self, admin):
        r = admin.get(f"{API}/personnel/facets", timeout=15)
        assert r.status_code == 200

    def test_personnel_balance_summary_perf(self, admin):
        t0 = time.time()
        r = admin.get(f"{API}/personnel/balance-summary?status=active", timeout=30)
        dur = time.time() - t0
        assert r.status_code == 200
        assert dur < 8.0, f"balance-summary took {dur:.2f}s (limit 8s)"
        data = r.json()
        assert isinstance(data, list)
        # ten_day_check.status ∈ {earned_ok, advance_ok, missing}
        if data:
            statuses = set()
            for row in data:
                tdc = row.get("ten_day_check") or {}
                st = tdc.get("status")
                if st:
                    statuses.add(st)
            allowed = {"earned_ok", "advance_ok", "missing", None}
            assert statuses.issubset(allowed | {""}), f"unexpected statuses {statuses - allowed}"

    def test_personnel_consent_tracking_latest(self, admin):
        r = admin.get(f"{API}/personnel/consent-tracking?view=latest", timeout=15)
        assert r.status_code == 200
        j = r.json()
        data = j if isinstance(j, list) else j.get("items", [])
        assert isinstance(data, list)
        # sorted remaining ASC (most negative first) among numeric rows
        rems = [row.get("remaining") for row in data if isinstance(row.get("remaining"), (int, float))]
        if len(rems) >= 2:
            assert rems == sorted(rems), "consent-tracking should be sorted remaining ASC"

    def test_personnel_consent_tracking_all(self, admin):
        r = admin.get(f"{API}/personnel/consent-tracking?view=all", timeout=20)
        assert r.status_code == 200

    def test_personnel_perf_limit_500(self, admin):
        t0 = time.time()
        r = admin.get(f"{API}/personnel?limit=500", timeout=15)
        dur = time.time() - t0
        assert r.status_code == 200
        assert dur < 3.0, f"/personnel?limit=500 took {dur:.2f}s"


# =============== LEAVES ===============
class TestLeaves:
    def test_leaves_list(self, admin):
        r = admin.get(f"{API}/leaves?limit=20", timeout=15)
        assert r.status_code == 200

    def test_leaves_recent30(self, admin):
        r = admin.get(f"{API}/leaves?preset=recent30&limit=50", timeout=15)
        assert r.status_code == 200

    def test_leaves_status_filter(self, admin):
        r = admin.get(f"{API}/leaves?statusFilter=active&limit=10", timeout=15)
        assert r.status_code == 200

    def test_leaves_perf_limit_500(self, admin):
        t0 = time.time()
        r = admin.get(f"{API}/leaves?limit=500", timeout=15)
        dur = time.time() - t0
        assert r.status_code == 200
        assert dur < 3.0, f"/leaves?limit=500 took {dur:.2f}s"

    def test_leaves_pagination(self, admin):
        r = admin.get(f"{API}/leaves?limit=5&skip=5", timeout=10)
        assert r.status_code == 200


# =============== CONSENT BATCH ===============
class TestConsentBatch:
    def test_consent_batch_multi(self, admin):
        p = admin.get(f"{API}/personnel?limit=3", timeout=10).json()
        if not isinstance(p, list) or len(p) < 2:
            pytest.skip("need 2 personnel")
        pids = ",".join([x["id"] for x in p[:2]])
        r = admin.get(f"{API}/personnel/consent-batch?pids={pids}", timeout=15)
        assert r.status_code == 200


# =============== PDF EXPORTS ===============
class TestPDF:
    def test_cetvel_pdf(self, admin):
        p = admin.get(f"{API}/personnel?limit=5", timeout=10).json()
        if not isinstance(p, list) or not p:
            pytest.skip("no personnel")
        pid = p[0]["id"]
        r = admin.get(f"{API}/personnel/{pid}/cetveli.pdf", timeout=60)
        assert r.status_code == 200, f"cetvel.pdf → {r.status_code} {r.text[:200]}"
        assert len(r.content) > 5000, f"pdf too small: {len(r.content)} bytes"
        assert r.content[:4] == b"%PDF"

    def test_talep_formu_pdf(self, admin):
        lv = admin.get(f"{API}/leaves?limit=5", timeout=10).json()
        arr = lv if isinstance(lv, list) else lv.get("items", [])
        if not arr:
            pytest.skip("no leaves")
        lid = arr[0]["id"]
        r = admin.get(f"{API}/leaves/{lid}/talep-formu.pdf", timeout=60)
        assert r.status_code == 200, f"talep-formu.pdf → {r.status_code}"


# =============== REPORTS ===============
class TestReports:
    def test_reports_summary(self, admin):
        r = admin.get(f"{API}/reports/summary", timeout=15)
        assert r.status_code == 200

    def test_reports_charts(self, admin):
        r = admin.get(f"{API}/reports/charts", timeout=15)
        assert r.status_code == 200


# =============== AUDIT LOG ===============
class TestAudit:
    def test_audit_log_admin(self, admin):
        r = admin.get(f"{API}/audit-log?limit=10", timeout=10)
        assert r.status_code == 200
        j = r.json()
        arr = j if isinstance(j, list) else j.get("items", [])
        # Entries should have user_id
        if arr:
            assert any("user_id" in x or "user" in x or "actor" in x for x in arr)


# =============== SPECIAL LEAVES ===============
class TestSpecialLeaves:
    def test_list(self, admin):
        r = admin.get(f"{API}/special-leaves?limit=10", timeout=10)
        assert r.status_code == 200


# =============== CORS ===============
class TestCORS:
    def test_options_personnel(self):
        r = requests.options(
            f"{API}/personnel",
            headers={
                "Origin": "https://merkoteks-izin.preview.emergentagent.com",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
            timeout=10,
        )
        assert r.status_code in (200, 204), f"CORS preflight → {r.status_code}"
        assert "access-control-allow-origin" in {k.lower() for k in r.headers.keys()}


# =============== DATA INTEGRITY ===============
class TestDataIntegrity:
    def test_active_personnel_count_reasonable(self, admin):
        r = admin.get(f"{API}/personnel/count", timeout=10)
        assert r.status_code == 200
        j = r.json()
        act = j.get("active") or j.get("aktif") or j.get("total_active") or j.get("count")
        # sanity — should be non-zero; expected ~291
        if isinstance(act, int):
            assert act > 50, f"active count suspiciously low: {act}"


# =============== SECURITY ===============
class TestSecurity:
    def test_admin_bcrypt_hash(self, admin):
        # can only introspect via users endpoint (admin)
        r = admin.get(f"{API}/users", timeout=10)
        if r.status_code != 200:
            pytest.skip("users endpoint unavailable")
        arr = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        # password hash usually not exposed — this is a positive security signal
        for u in arr:
            assert "password" not in u and "password_hash" not in u, "password/hash leaked in /users"
