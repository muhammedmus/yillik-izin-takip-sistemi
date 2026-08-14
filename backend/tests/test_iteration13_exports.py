"""Iteration 13: Audit log export xlsx/pdf endpoints + PersonnelForm date filter regression."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def hr_token(admin_token):
    # Find hr user, reset password to a known value via admin
    r = requests.get(f"{API}/users", headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200
    hr = next((u for u in r.json() if u.get("role") == "hr"), None)
    if not hr:
        pytest.skip("No HR user available")
    new_pw = "HrTest1234!"
    rr = requests.post(f"{API}/users/{hr['id']}/reset-password",
                       json={"new_password": new_pw},
                       headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert rr.status_code in (200, 204), rr.text
    lg = requests.post(f"{API}/auth/login", json={"email": hr["email"], "password": new_pw}, timeout=10)
    assert lg.status_code == 200, lg.text
    return lg.json()["token"]


def test_export_xlsx_admin(admin_token):
    r = requests.get(f"{API}/audit-log/export.xlsx",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    assert "spreadsheetml" in r.headers.get("content-type", "")
    assert r.content[:2] == b"PK"  # xlsx magic (zip)
    assert len(r.content) > 500
    assert "denetim-kayitlari.xlsx" in r.headers.get("content-disposition", "")


def test_export_pdf_admin(admin_token):
    r = requests.get(f"{API}/audit-log/export.pdf",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content[:4] == b"%PDF"
    assert "denetim-kayitlari.pdf" in r.headers.get("content-disposition", "")


def test_export_xlsx_with_module_filter(admin_token):
    r = requests.get(f"{API}/audit-log/export.xlsx?module=users&limit=1000",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    assert r.content[:2] == b"PK"


def test_export_forbidden_for_hr(hr_token):
    r = requests.get(f"{API}/audit-log/export.xlsx",
                     headers={"Authorization": f"Bearer {hr_token}"}, timeout=10)
    assert r.status_code == 403
    r2 = requests.get(f"{API}/audit-log/export.pdf",
                      headers={"Authorization": f"Bearer {hr_token}"}, timeout=10)
    assert r2.status_code == 403


def test_personnel_crud_hire_date_format(admin_token):
    """Regression: create/update/delete personnel with hire_date (ISO date)."""
    h = {"Authorization": f"Bearer {admin_token}"}
    # Cleanup any prior 9999-TEST
    lst = requests.get(f"{API}/personnel?q=9999-TEST", headers=h, timeout=10)
    if lst.status_code == 200:
        js = lst.json()
        for p in (js.get("items") if isinstance(js, dict) else js) or []:
            if p.get("sicil_no") == "9999-TEST":
                requests.delete(f"{API}/personnel/{p['id']}", headers=h, timeout=10)

    payload = {
        "sicil_no": "9999-TEST",
        "ad_soyad": "QA DatePicker Test",
        "ise_giris": "2020-03-15",
        "departman": "QA",
        "aktif": True,
    }
    cr = requests.post(f"{API}/personnel", json=payload, headers=h, timeout=15)
    assert cr.status_code in (200, 201), cr.text
    pid = cr.json()["id"]
    assert cr.json().get("ise_giris", "").startswith("2020-03-15")

    # Update birth_date
    up = requests.put(f"{API}/personnel/{pid}",
                      json={**cr.json(), "dogum_tarihi": "1990-05-20"},
                      headers=h, timeout=15)
    assert up.status_code == 200, up.text
    assert up.json().get("dogum_tarihi", "").startswith("1990-05-20")

    # Cleanup
    d = requests.delete(f"{API}/personnel/{pid}", headers=h, timeout=10)
    assert d.status_code in (200, 204)
