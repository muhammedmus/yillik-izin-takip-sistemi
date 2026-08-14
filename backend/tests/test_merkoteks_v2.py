"""Backend tests for Merkoteks Personel ve İzin Sistemi — Iteration 2.

Covers:
- New leave entitlement rules (hire+1yr anniversaries, seniority buckets, age rule)
- Entitlement immutability + recalculate
- Bulk Excel import + template
- Charts endpoint
- Email/leave notification response
- Personnel email field + regression tests
"""
import io
import os
import pytest
import requests
from datetime import date
from openpyxl import Workbook

def _read_frontend_env():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        with open(p) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    return None

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
ADMIN_EMAIL = "muhammedmus@gmail.com"
ADMIN_PASSWORD = "Merkoteks2026!"

# Cache of created test personnel ids for cleanup
CREATED_PIDS: list = []
CREATED_LIDS: list = []


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def _cleanup(client):
    yield
    # Best-effort cleanup — never fail tests on cleanup
    try:
        for lid in CREATED_LIDS:
            client.delete(f"{BASE_URL}/api/leaves/{lid}")
        for pid in CREATED_PIDS:
            client.delete(f"{BASE_URL}/api/personnel/{pid}")
    except Exception:
        pass


def _create_personnel(client, sicil, ad_soyad="TEST User", ise_giris="2020-01-01",
                      onceki_kidem_yil=0, dogum_tarihi=None, email=""):
    payload = {
        "sicil_no": sicil, "ad_soyad": ad_soyad, "ise_giris": ise_giris,
        "onceki_kidem_yil": onceki_kidem_yil,
        "dogum_tarihi": dogum_tarihi, "departman": "Test", "sirket": "Merkoteks",
        "email": email,
    }
    r = client.post(f"{BASE_URL}/api/personnel", json=payload)
    assert r.status_code == 200, f"Create personnel {sicil} failed: {r.status_code} {r.text}"
    pid = r.json()["id"]
    CREATED_PIDS.append(pid)
    return pid, r.json()


# ---------------------------------------------------------------------------
# Auth regression
# ---------------------------------------------------------------------------
class TestAuth:
    def test_login_admin(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_login_bad(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Entitlement rules — 6 seniority scenarios
# ---------------------------------------------------------------------------
def _expected_days(total_seniority, age_at=None):
    if total_seniority <= 5:
        base = 14
    elif total_seniority < 15:
        base = 20
    else:
        base = 26
    age_days = 20 if (age_at is not None and (age_at < 18 or age_at >= 50)) else 0
    return max(base, age_days)


class TestEntitlementRules:
    HIRE = "2020-01-01"
    DOGUM = "1990-01-01"  # 30 at hire

    @pytest.mark.parametrize("prev", [0, 4, 5, 6, 14, 15])
    def test_seniority_scenario(self, client, prev):
        sicil = f"TEST_P{prev}"
        # Cleanup any lingering
        existing = client.get(f"{BASE_URL}/api/personnel", params={"q": sicil}).json()
        for e in existing:
            if e["sicil_no"] == sicil:
                client.delete(f"{BASE_URL}/api/personnel/{e['id']}")
        pid, _ = _create_personnel(client, sicil, ise_giris=self.HIRE,
                                   onceki_kidem_yil=prev, dogum_tarihi=self.DOGUM)
        r = client.get(f"{BASE_URL}/api/personnel/{pid}/balance")
        assert r.status_code == 200, r.text
        bal = r.json()["balance"]
        ents = bal["entitlements"]
        assert len(ents) >= 1, "Should have at least 1 entitlement by 2026"

        hire_d = date.fromisoformat(self.HIRE)
        # First entitlement must be exactly hire + 1 year, NOT hire date
        first_date = date.fromisoformat(ents[0]["date"])
        assert first_date == date(hire_d.year + 1, hire_d.month, hire_d.day), \
            f"prev={prev}: first entitlement expected {hire_d.year+1}-01-01, got {first_date}"
        assert first_date != hire_d, "Entitlement must not be on hire date"

        # For each entitlement verify date is anniversary and days match rule
        for i, e in enumerate(ents, start=1):
            expected_anniv = date(hire_d.year + i, hire_d.month, hire_d.day)
            assert e["date"] == expected_anniv.isoformat(), \
                f"prev={prev} year {i}: date {e['date']} != {expected_anniv}"
            total = prev + i
            age_at = (expected_anniv - date.fromisoformat(self.DOGUM)).days / 365.25
            expected = _expected_days(total, age_at)
            assert e["days"] == expected, \
                f"prev={prev} year {i} total={total}: expected {expected}, got {e['days']}"
            assert e["total_seniority"] == total
            assert e["prev_years"] == prev
            assert e["new_period_years"] == i

    def test_prev5_first_anniv_20_days(self, client):
        """prev=5, first anniv total=6 → 20 days per requirement example."""
        r = client.get(f"{BASE_URL}/api/personnel", params={"q": "TEST_P5"}).json()
        pid = next(p["id"] for p in r if p["sicil_no"] == "TEST_P5")
        bal = client.get(f"{BASE_URL}/api/personnel/{pid}/balance").json()["balance"]
        assert bal["entitlements"][0]["days"] == 20
        assert bal["entitlements"][0]["total_seniority"] == 6

    def test_prev14_first_anniv_26_days(self, client):
        """prev=14, first anniv total=15 → 26 days."""
        r = client.get(f"{BASE_URL}/api/personnel", params={"q": "TEST_P14"}).json()
        pid = next(p["id"] for p in r if p["sicil_no"] == "TEST_P14")
        bal = client.get(f"{BASE_URL}/api/personnel/{pid}/balance").json()["balance"]
        assert bal["entitlements"][0]["days"] == 26
        assert bal["entitlements"][0]["total_seniority"] == 15


# ---------------------------------------------------------------------------
# Age rule (50+)
# ---------------------------------------------------------------------------
class TestAgeRule:
    def test_over_50_gets_20_days(self, client):
        sicil = "TEST_AGE50"
        existing = client.get(f"{BASE_URL}/api/personnel", params={"q": sicil}).json()
        for e in existing:
            if e["sicil_no"] == sicil:
                client.delete(f"{BASE_URL}/api/personnel/{e['id']}")
        pid, _ = _create_personnel(client, sicil, ise_giris="2020-01-01",
                                   onceki_kidem_yil=0, dogum_tarihi="1955-01-01")
        bal = client.get(f"{BASE_URL}/api/personnel/{pid}/balance").json()["balance"]
        first = bal["entitlements"][0]
        assert first["total_seniority"] == 1
        assert first["days"] == 20, f"Age 50+ should force 20 days, got {first['days']}"


# ---------------------------------------------------------------------------
# Immutability + recalculate
# ---------------------------------------------------------------------------
class TestImmutability:
    def test_stored_entitlements_immutable(self, client):
        sicil = "TEST_IMMUT"
        existing = client.get(f"{BASE_URL}/api/personnel", params={"q": sicil}).json()
        for e in existing:
            if e["sicil_no"] == sicil:
                client.delete(f"{BASE_URL}/api/personnel/{e['id']}")
        pid, _ = _create_personnel(client, sicil, ise_giris="2020-01-01",
                                   onceki_kidem_yil=0, dogum_tarihi="1990-01-01")
        # Materialize
        bal1 = client.get(f"{BASE_URL}/api/personnel/{pid}/balance").json()["balance"]
        stored_prev = [e["prev_years"] for e in bal1["entitlements"]]
        assert all(v == 0 for v in stored_prev)
        n_stored = len(bal1["entitlements"])
        assert n_stored >= 1

        # Update prev_years to 10
        upd = {
            "sicil_no": sicil, "ad_soyad": "TEST User", "ise_giris": "2020-01-01",
            "onceki_kidem_yil": 10, "dogum_tarihi": "1990-01-01",
            "departman": "Test", "sirket": "Merkoteks", "email": "",
        }
        r = client.put(f"{BASE_URL}/api/personnel/{pid}", json=upd)
        assert r.status_code == 200
        assert r.json()["onceki_kidem_yil"] == 10

        # Get balance again — stored entitlements must still have prev_years=0
        bal2 = client.get(f"{BASE_URL}/api/personnel/{pid}/balance").json()["balance"]
        assert len(bal2["entitlements"]) == n_stored
        for e in bal2["entitlements"]:
            assert e["prev_years"] == 0, f"Stored record mutated! prev_years={e['prev_years']}"

        # Recalculate — now all records should reflect prev_years=10
        rr = client.post(f"{BASE_URL}/api/personnel/{pid}/recalculate")
        assert rr.status_code == 200
        bal3 = rr.json()["balance"]
        for e in bal3["entitlements"]:
            assert e["prev_years"] == 10, f"After recalc: prev_years={e['prev_years']}"


# ---------------------------------------------------------------------------
# Bulk Excel import
# ---------------------------------------------------------------------------
class TestBulkImport:
    def test_template_download(self, client):
        r = client.get(f"{BASE_URL}/api/personnel/import/template")
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and ".xlsx" in cd.lower()
        assert r.content[:2] == b"PK"  # xlsx is a zip

    def test_import_with_duplicate(self, client):
        # Ensure BULK001 & BULK002 don't exist
        for s in ("BULK001", "BULK002"):
            existing = client.get(f"{BASE_URL}/api/personnel", params={"q": s}).json()
            for e in existing:
                if e["sicil_no"] == s:
                    client.delete(f"{BASE_URL}/api/personnel/{e['id']}")

        # Ensure E001 exists (regression seed) — create if missing
        e001 = client.get(f"{BASE_URL}/api/personnel", params={"q": "E001"}).json()
        e001_exists = any(p["sicil_no"] == "E001" for p in e001)
        if not e001_exists:
            client.post(f"{BASE_URL}/api/personnel", json={
                "sicil_no": "E001", "ad_soyad": "Ali Yılmaz",
                "ise_giris": "2019-03-15", "departman": "Üretim", "sirket": "Merkoteks",
            })

        wb = Workbook()
        ws = wb.active
        ws.append(["sicil_no", "ad_soyad", "ise_giris", "departman"])
        ws.append(["BULK001", "Bulk User 1", "2022-05-01", "Muhasebe"])
        ws.append(["BULK002", "Bulk User 2", "2023-06-15", "Satış"])
        ws.append(["E001", "Duplicate", "2020-01-01", "X"])
        buf = io.BytesIO()
        wb.save(buf); buf.seek(0)

        # multipart — use fresh session with only auth header (no Content-Type)
        r = requests.post(
            f"{BASE_URL}/api/personnel/import",
            headers={"Authorization": client.headers["Authorization"]},
            files={"file": ("test.xlsx", buf.getvalue(),
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data["created"] == 2, f"created={data['created']}"
        assert data["skipped"] == 1, f"skipped={data['skipped']}"
        assert data["errors"] == []

        # Cleanup
        for s in ("BULK001", "BULK002"):
            existing = client.get(f"{BASE_URL}/api/personnel", params={"q": s}).json()
            for e in existing:
                if e["sicil_no"] == s:
                    client.delete(f"{BASE_URL}/api/personnel/{e['id']}")


# ---------------------------------------------------------------------------
# Charts endpoint
# ---------------------------------------------------------------------------
class TestCharts:
    def test_charts_shape(self, client):
        r = client.get(f"{BASE_URL}/api/reports/charts")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["departments"], list)
        if d["departments"]:
            assert "name" in d["departments"][0] and "value" in d["departments"][0]
        assert isinstance(d["monthly_trend"], list) and len(d["monthly_trend"]) == 12
        # Turkish month labels
        tr_months = {"Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"}
        for m in d["monthly_trend"]:
            assert "month" in m and "days" in m
            assert m["month"].split(" ")[0] in tr_months
        assert isinstance(d["companies"], list)
        assert isinstance(d["remaining_dist"], list)
        keys = {b["name"] for b in d["remaining_dist"]}
        assert {"0-5", "6-10", "11-15", "16-20", "20+"}.issubset(keys)


# ---------------------------------------------------------------------------
# Email + leave creation
# ---------------------------------------------------------------------------
class TestLeaveEmail:
    def test_leave_creation_notified(self, client):
        sicil = "TEST_EMAIL"
        existing = client.get(f"{BASE_URL}/api/personnel", params={"q": sicil}).json()
        for e in existing:
            if e["sicil_no"] == sicil:
                client.delete(f"{BASE_URL}/api/personnel/{e['id']}")
        pid, _ = _create_personnel(client, sicil, ise_giris="2020-01-01",
                                   onceki_kidem_yil=0, dogum_tarihi="1990-01-01",
                                   email="test@example.com")
        # Create a 2-day leave (weekday range)
        r = client.post(f"{BASE_URL}/api/leaves", json={
            "personnel_id": pid, "start_date": "2026-02-02", "end_date": "2026-02-03",
            "izin_turu": "Yıllık İzin", "aciklama": "test",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        CREATED_LIDS.append(data["id"])
        assert "notified" in data
        notified = data["notified"]
        assert "test@example.com" in notified
        assert ADMIN_EMAIL.lower() in notified
        assert data["days"] == 2


# ---------------------------------------------------------------------------
# Personnel email field & regression
# ---------------------------------------------------------------------------
class TestPersonnelFields:
    def test_email_and_prev_int(self, client):
        sicil = "TEST_FIELDS"
        existing = client.get(f"{BASE_URL}/api/personnel", params={"q": sicil}).json()
        for e in existing:
            if e["sicil_no"] == sicil:
                client.delete(f"{BASE_URL}/api/personnel/{e['id']}")
        r = client.post(f"{BASE_URL}/api/personnel", json={
            "sicil_no": sicil, "ad_soyad": "Field Test", "ise_giris": "2021-01-01",
            "email": "field@example.com", "onceki_kidem_yil": 3,
        })
        assert r.status_code == 200
        pid = r.json()["id"]
        CREATED_PIDS.append(pid)
        assert r.json()["email"] == "field@example.com"
        assert r.json()["onceki_kidem_yil"] == 3

        # GET returns it
        g = client.get(f"{BASE_URL}/api/personnel/{pid}").json()
        assert g["email"] == "field@example.com"

        # PUT updates it
        upd = {**g, "email": "updated@example.com", "onceki_kidem_yil": 7}
        # strip fields not in PersonnelIn
        for k in ("id", "created_at"):
            upd.pop(k, None)
        u = client.put(f"{BASE_URL}/api/personnel/{pid}", json=upd)
        assert u.status_code == 200
        assert u.json()["email"] == "updated@example.com"
        assert u.json()["onceki_kidem_yil"] == 7


# ---------------------------------------------------------------------------
# Regression
# ---------------------------------------------------------------------------
class TestRegression:
    def test_e001_balance(self, client):
        r = client.get(f"{BASE_URL}/api/personnel", params={"q": "E001"})
        assert r.status_code == 200
        rows = r.json()
        if not any(p["sicil_no"] == "E001" for p in rows):
            pytest.skip("E001 seed not present")
        pid = next(p["id"] for p in rows if p["sicil_no"] == "E001")
        b = client.get(f"{BASE_URL}/api/personnel/{pid}/balance")
        assert b.status_code == 200
        assert "balance" in b.json()

    def test_dashboard(self, client):
        r = client.get(f"{BASE_URL}/api/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "active", "left", "on_leave_today", "new_this_month", "low_balance"):
            assert k in d

    def test_holidays(self, client):
        r = client.get(f"{BASE_URL}/api/holidays")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_delete_leave(self, client):
        # Create & delete a leave
        sicil = "TEST_DEL_L"
        existing = client.get(f"{BASE_URL}/api/personnel", params={"q": sicil}).json()
        for e in existing:
            if e["sicil_no"] == sicil:
                client.delete(f"{BASE_URL}/api/personnel/{e['id']}")
        pid, _ = _create_personnel(client, sicil, ise_giris="2019-01-01",
                                   onceki_kidem_yil=0)
        cr = client.post(f"{BASE_URL}/api/leaves", json={
            "personnel_id": pid, "start_date": "2026-03-02", "end_date": "2026-03-03",
        })
        assert cr.status_code == 200
        lid = cr.json()["id"]
        dr = client.delete(f"{BASE_URL}/api/leaves/{lid}")
        assert dr.status_code == 200

    def test_delete_personnel(self, client):
        sicil = "TEST_DEL_P"
        existing = client.get(f"{BASE_URL}/api/personnel", params={"q": sicil}).json()
        for e in existing:
            if e["sicil_no"] == sicil:
                client.delete(f"{BASE_URL}/api/personnel/{e['id']}")
        r = client.post(f"{BASE_URL}/api/personnel", json={
            "sicil_no": sicil, "ad_soyad": "Del Test", "ise_giris": "2022-01-01",
        })
        pid = r.json()["id"]
        d = client.delete(f"{BASE_URL}/api/personnel/{pid}")
        assert d.status_code == 200
