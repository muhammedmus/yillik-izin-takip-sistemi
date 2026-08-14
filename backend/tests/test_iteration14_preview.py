"""Iteration 14 — Leave print/preview endpoints regression."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://merkoteks-izin.preview.emergentagent.com").rstrip("/")
LID = "93a0f65d-2b18-4d1b-9c3e-9a10cac8ab46"  # NURSEMA TUAÇ, 2026-08-11→2026-08-14 (4d)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"},
                      timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_leave_print_meta(H):
    r = requests.get(f"{BASE}/api/leaves/{LID}/print", headers=H, timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert "personnel" in d and "leave" in d
    p = d["personnel"]
    # required fields for muvafakatname
    for k in ("ad_soyad", "sicil_no", "tc_no", "ise_giris", "departman"):
        assert k in p, f"missing {k}"
    assert d["leave"]["days"] == 4
    # next_entitlement expected inside balance
    bal = d.get("balance") or {}
    assert "next_entitlement" in bal, f"no next_entitlement: keys={list(bal.keys())}"


def test_leave_talep_pdf(H):
    r = requests.get(f"{BASE}/api/leaves/{LID}/talep-formu.pdf", headers=H, timeout=60)
    assert r.status_code == 200, r.text[:300]
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert len(r.content) > 5000, f"pdf too small: {len(r.content)}"
    assert r.content[:4] == b"%PDF"


def test_leave_talep_xlsx(H):
    r = requests.get(f"{BASE}/api/leaves/{LID}/talep-formu.xlsx", headers=H, timeout=60)
    assert r.status_code == 200, r.text[:300]
    ctype = r.headers.get("content-type", "")
    assert "spreadsheet" in ctype or "excel" in ctype, ctype
    assert len(r.content) > 5000


def test_leave_endpoints_unauth():
    for suffix in ("print", "talep-formu.pdf", "talep-formu.xlsx"):
        r = requests.get(f"{BASE}/api/leaves/{LID}/{suffix}", timeout=30)
        assert r.status_code in (401, 403), f"{suffix} → {r.status_code}"
