"""Regression test: GET /api/personnel with unknown sort fields must fallback to ad_soyad (no crash)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://merkoteks-izin.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "muhammedmus@gmail.com"
ADMIN_PASS = "Merkoteks2026!"


@pytest.fixture(scope="module")
def token():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in {data}"
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("sort_by", ["age", "ten_day", "cetvel", "remaining", "ad_soyad", "sicil_no", "departman", "sirket", "ise_giris"])
def test_personnel_sort_field(headers, sort_by):
    r = requests.get(f"{API}/personnel", params={"aktif": "true", "sort_by": sort_by, "sort_dir": "asc", "limit": 10, "skip": 0}, headers=headers, timeout=30)
    assert r.status_code == 200, f"{sort_by}: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert isinstance(data, list)


def test_personnel_active_count_positive(headers):
    r = requests.get(f"{API}/personnel/count", params={"aktif": "true"}, headers=headers, timeout=30)
    assert r.status_code == 200
    total = r.json().get("total")
    assert isinstance(total, int) and total > 0, f"expected active personnel > 0, got {total}"


def test_personnel_list_active_nonempty(headers):
    r = requests.get(f"{API}/personnel", params={"aktif": "true", "sort_by": "sicil_no", "sort_dir": "asc", "limit": 50, "skip": 0}, headers=headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
