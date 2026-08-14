"""Iteration 14 new features tests: monthly_trend people, Excel preview/confirm, bulk-update, bulk-delete."""
import io
import os
import pytest
import requests
from openpyxl import Workbook

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://merkoteks-izin.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}
HR = {"email": "muhammedmus@hotmail.com", "password": "HrTest1234"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def hr():
    return _login(HR)


# ---------- TEST 1: monthly_trend people ----------
def test_reports_charts_monthly_trend_has_people(admin):
    r = admin.get(f"{API}/reports/charts", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "monthly_trend" in data
    mt = data["monthly_trend"]
    assert isinstance(mt, list) and len(mt) == 12
    for row in mt:
        assert "month" in row and "days" in row and "people" in row
        assert isinstance(row["people"], int)


# ---------- helpers ----------
def _make_xlsx(rows, with_header=True):
    wb = Workbook()
    ws = wb.active
    if with_header:
        ws.append(["Tarih", "Tatil Tanımı", "Gün Değeri"])
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# ---------- TEST 2: preview ----------
def test_excel_preview_stats_and_rows(admin):
    # rows: valid, empty name (review), invalid date, duplicate within file
    xlsx = _make_xlsx([
        ["01.01.2027", "Yılbaşı Testi", 1],
        ["23.04.2027", "", 1],  # review (empty name)
        ["not-a-date", "Bozuk", 1],  # invalid
        ["01.01.2027", "Yılbaşı Testi", 1],  # duplicate in file
        ["01.05.2027", "Emek Bayramı Testi", 0.5],
    ], with_header=True)
    files = {"file": ("test.xlsx", xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r = admin.post(f"{API}/holidays/import/excel/preview", files=files, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "stats" in data and "rows" in data
    stats = data["stats"]
    for k in ("total", "valid", "duplicate", "invalid", "review"):
        assert k in stats
    assert stats["total"] >= 5
    assert stats["invalid"] >= 1
    assert stats["duplicate"] >= 1
    assert stats["review"] >= 1
    # find review row
    review_rows = [x for x in data["rows"] if x.get("status") == "review"]
    assert review_rows and review_rows[0].get("needs_review") is True


# ---------- TEST 3: confirm writes valid/review only ----------
@pytest.fixture(scope="module")
def preview_and_confirm(admin):
    """Preview + confirm a batch of 2027 holidays used by later tests."""
    xlsx = _make_xlsx([
        ["20.12.2027", "Merkoteks Test Tatili A", 1],
        ["21.12.2027", "Merkoteks Test Tatili B", 1],
        ["22.12.2027", "", 0.5],  # review
    ])
    files = {"file": ("t.xlsx", xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    pr = admin.post(f"{API}/holidays/import/excel/preview", files=files, timeout=60)
    assert pr.status_code == 200
    payload = {"filename": "t.xlsx", "rows": pr.json()["rows"]}
    cr = admin.post(f"{API}/holidays/import/excel/confirm", json=payload, timeout=60)
    assert cr.status_code == 200
    return cr.json()


def test_excel_confirm_added_skipped(preview_and_confirm):
    data = preview_and_confirm
    assert "added" in data and "skipped" in data and "affected_years" in data
    assert data["added"] >= 3
    assert 2027 in data["affected_years"]


# ---------- TEST 4: duplicate protection ----------
def test_excel_reimport_produces_duplicates(admin, preview_and_confirm):
    xlsx = _make_xlsx([
        ["20.12.2027", "Merkoteks Test Tatili A", 1],
        ["21.12.2027", "Merkoteks Test Tatili B", 1],
    ])
    files = {"file": ("t2.xlsx", xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    pr = admin.post(f"{API}/holidays/import/excel/preview", files=files, timeout=60)
    assert pr.status_code == 200
    stats = pr.json()["stats"]
    assert stats["duplicate"] >= 2
    # confirm should skip duplicates
    cr = admin.post(f"{API}/holidays/import/excel/confirm",
                    json={"filename": "t2.xlsx", "rows": pr.json()["rows"]}, timeout=60)
    assert cr.status_code == 200
    j = cr.json()
    assert j["added"] == 0
    assert j["skipped"] >= 2


# ---------- helper to get IDs ----------
def _get_holidays_by_year(session, year):
    r = session.get(f"{API}/holidays/records?year={year}", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- TEST: single-row update via PUT /holidays/records/{rid} ----------
def test_single_holiday_update(admin, preview_and_confirm):
    all27 = _get_holidays_by_year(admin, 2027)
    review_recs = [h for h in all27 if h.get("needs_review")]
    assert review_recs, "no review record found"
    target = review_recs[0]
    rid = target["id"]
    r = admin.put(f"{API}/holidays/records/{rid}", json={"name": "TEST_Kontrol_Test_Ad"}, timeout=30)
    assert r.status_code == 200, r.text
    # verify persisted
    all27b = _get_holidays_by_year(admin, 2027)
    updated = [h for h in all27b if h["id"] == rid][0]
    assert updated["name"] == "TEST_Kontrol_Test_Ad"
    assert updated.get("needs_review") in (False, None)


# ---------- TEST 7: bulk-update name ----------
def test_bulk_update_name(admin, preview_and_confirm):
    all27 = _get_holidays_by_year(admin, 2027)
    targets = [h for h in all27 if h["name"] in ("Merkoteks Test Tatili A", "Merkoteks Test Tatili B")]
    assert len(targets) >= 2
    ids = [t["id"] for t in targets]
    r = admin.post(f"{API}/holidays/records/bulk-update", json={"ids": ids, "name": "Toplu Ad Test"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["updated"] >= 2
    all27b = _get_holidays_by_year(admin, 2027)
    for tid in ids:
        rec = [h for h in all27b if h["id"] == tid][0]
        assert rec["name"] == "Toplu Ad Test"


# ---------- TEST 8: bulk-update active ----------
def test_bulk_update_active(admin, preview_and_confirm):
    all27 = _get_holidays_by_year(admin, 2027)
    targets = [h for h in all27 if h["name"] == "Toplu Ad Test"]
    assert targets
    ids = [t["id"] for t in targets]
    r = admin.post(f"{API}/holidays/records/bulk-update", json={"ids": ids, "active": False}, timeout=30)
    assert r.status_code == 200
    all27b = _get_holidays_by_year(admin, 2027)
    for tid in ids:
        rec = [h for h in all27b if h["id"] == tid][0]
        assert rec["active"] is False
    # re-activate
    admin.post(f"{API}/holidays/records/bulk-update", json={"ids": ids, "active": True}, timeout=30)


def test_bulk_update_validation(admin):
    r = admin.post(f"{API}/holidays/records/bulk-update", json={"ids": []}, timeout=30)
    assert r.status_code == 400
    r2 = admin.post(f"{API}/holidays/records/bulk-update", json={"ids": ["xxx"]}, timeout=30)
    assert r2.status_code == 400  # no update fields


# ---------- TEST 9 & 10: bulk-delete admin-only, password + reason ----------
def test_bulk_delete_hr_forbidden(hr, preview_and_confirm):
    all27 = _get_holidays_by_year(hr, 2027)
    ids = [h["id"] for h in all27 if h.get("source", "").startswith("Excel:")][:1]
    if not ids:
        pytest.skip("no test holidays for HR delete check")
    r = hr.post(f"{API}/holidays/records/bulk-delete",
                json={"ids": ids, "password": "x", "reason": "y"}, timeout=30)
    assert r.status_code == 403


def test_bulk_delete_requires_password_reason(admin, preview_and_confirm):
    all27 = _get_holidays_by_year(admin, 2027)
    ids = [h["id"] for h in all27 if h.get("source", "").startswith("Excel:")][:1]
    assert ids
    # missing reason
    r1 = admin.post(f"{API}/holidays/records/bulk-delete",
                    json={"ids": ids, "password": ADMIN["password"], "reason": ""}, timeout=30)
    assert r1.status_code == 400
    # wrong password
    r2 = admin.post(f"{API}/holidays/records/bulk-delete",
                    json={"ids": ids, "password": "wrongpass", "reason": "test"}, timeout=30)
    assert r2.status_code == 403


def test_bulk_delete_success_admin(admin, preview_and_confirm):
    all27 = _get_holidays_by_year(admin, 2027)
    # only delete our test records to avoid touching production
    ids = [h["id"] for h in all27 if h.get("source", "").startswith("Excel:")]
    assert ids, "no excel-imported 2027 records to delete"
    r = admin.post(f"{API}/holidays/records/bulk-delete",
                   json={"ids": ids, "password": ADMIN["password"], "reason": "iteration14 cleanup"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] >= len(ids)
    # verify removed
    all27b = _get_holidays_by_year(admin, 2027)
    remaining = [h for h in all27b if h["id"] in ids]
    assert not remaining
