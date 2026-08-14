"""Iteration 9 backend regressions:
- Optimistic concurrency: PUT /api/leaves/{lid} with If-Match header
- Regression: POST /api/leaves 409 conflict, GET /api/leaves/calendar shape
"""
import os
import pytest
import requests
from datetime import date, timedelta

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.fixture(scope="module")
def personnel_id(client):
    # Create dedicated test personnel
    payload = {
        "sicil_no": "TEST9_IFM",
        "ad_soyad": "Iter9 IfMatch Test",
        "tc_no": "12345678901",
        "dogum_tarihi": "1990-01-01",
        "ise_giris": "2020-01-01",
        "gorev": "Test",
        "departman": "Test",
        "aktif": True,
    }
    r = client.post(f"{BASE}/personnel", json=payload)
    if r.status_code in (200, 201):
        pid = r.json()["id"]
    else:
        # maybe exists
        lst = client.get(f"{BASE}/personnel", params={"aktif": True}).json()
        pid = next((p["id"] for p in lst if p.get("sicil_no") == "TEST9_IFM"), None)
        if not pid:
            pytest.skip(f"Cannot create/find personnel: {r.status_code} {r.text}")
    yield pid
    # cleanup: soft-delete not tested; leave record cleanup only
    # delete leaves
    leaves = client.get(f"{BASE}/leaves", params={"personnel_id": pid}).json()
    for L in leaves if isinstance(leaves, list) else []:
        client.delete(f"{BASE}/leaves/{L['id']}")
    client.delete(f"{BASE}/personnel/{pid}")


def _mkleave(client, pid, start, end):
    r = client.post(f"{BASE}/leaves", json={
        "personnel_id": pid, "start_date": start, "end_date": end,
        "izin_turu": "Yıllık İzin", "aciklama": "test"
    })
    return r


class TestOptimisticConcurrency:
    """PUT /api/leaves/{lid} If-Match header — per iteration 9 review request"""

    def test_if_match_412_on_stale(self, client, personnel_id):
        r = _mkleave(client, personnel_id, "2027-03-01", "2027-03-03")
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        stale = "1999-01-01T00:00:00+00:00"
        upd = client.put(f"{BASE}/leaves/{lid}",
                         headers={"If-Match": stale},
                         json={"personnel_id": personnel_id,
                               "start_date": "2027-03-01", "end_date": "2027-03-04",
                               "izin_turu": "Yıllık İzin", "aciklama": "upd"})
        # per review request should be 412
        assert upd.status_code == 412, (
            f"Expected 412 on stale If-Match; got {upd.status_code}: {upd.text}"
        )

    def test_if_match_200_on_correct(self, client, personnel_id):
        r = _mkleave(client, personnel_id, "2027-04-01", "2027-04-03")
        assert r.status_code == 200
        lid = r.json()["id"]
        got = client.get(f"{BASE}/leaves/single/{lid}")
        assert got.status_code == 200, got.text
        upd_at = got.json().get("updated_at") or got.json().get("created_at")
        assert upd_at, "leave missing updated_at/created_at field"
        upd = client.put(f"{BASE}/leaves/{lid}",
                         headers={"If-Match": upd_at},
                         json={"personnel_id": personnel_id,
                               "start_date": "2027-04-01", "end_date": "2027-04-05",
                               "izin_turu": "Yıllık İzin", "aciklama": "upd"})
        assert upd.status_code == 200, upd.text

    def test_no_if_match_backward_compat(self, client, personnel_id):
        r = _mkleave(client, personnel_id, "2027-05-01", "2027-05-03")
        assert r.status_code == 200
        lid = r.json()["id"]
        upd = client.put(f"{BASE}/leaves/{lid}",
                         json={"personnel_id": personnel_id,
                               "start_date": "2027-05-01", "end_date": "2027-05-04",
                               "izin_turu": "Yıllık İzin", "aciklama": "upd"})
        assert upd.status_code == 200, upd.text


class TestGetSingleLeave:
    def test_get_single_leave_endpoint(self, client, personnel_id):
        r = _mkleave(client, personnel_id, "2027-08-01", "2027-08-03")
        assert r.status_code == 200
        lid = r.json()["id"]
        got = client.get(f"{BASE}/leaves/single/{lid}")
        assert got.status_code == 200, got.text
        data = got.json()
        assert data["id"] == lid
        assert data["personnel_id"] == personnel_id
        assert "start_date" in data and "end_date" in data
        assert data.get("updated_at") or data.get("created_at"), "missing timestamp"


class TestRegression:
    def test_calendar_shape(self, client):
        r = client.get(f"{BASE}/leaves/calendar", params={"year": 2026, "month": 8})
        assert r.status_code == 200
        data = r.json()
        assert "days" in data and "same_person_conflicts" in data
        for d in data["days"]:
            assert "conflict" not in d, "day objects must NOT have 'conflict' field"

    def test_post_conflict_409(self, client, personnel_id):
        r1 = _mkleave(client, personnel_id, "2027-06-10", "2027-06-15")
        assert r1.status_code == 200
        r2 = _mkleave(client, personnel_id, "2027-06-14", "2027-06-18")
        assert r2.status_code == 409, r2.text
        d = r2.json()["detail"]
        assert isinstance(d, dict)
        for k in ("message", "personnel_ad_soyad", "existing_id",
                  "existing_start", "existing_end", "overlap_dates"):
            assert k in d, f"missing key: {k}"

    def test_talep_formu_pdf(self, client, personnel_id):
        r = _mkleave(client, personnel_id, "2027-07-01", "2027-07-03")
        assert r.status_code == 200
        lid = r.json()["id"]
        pdf = client.get(f"{BASE}/leaves/{lid}/talep-formu.pdf")
        assert pdf.status_code == 200
        assert pdf.content[:4] == b"%PDF"

    def test_cetveli_pdf(self, client, personnel_id):
        pdf = client.get(f"{BASE}/personnel/{personnel_id}/cetveli.pdf",
                         params={"year": 2027})
        assert pdf.status_code == 200
        assert pdf.content[:4] == b"%PDF"
