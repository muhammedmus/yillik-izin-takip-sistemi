"""Iteration 24 — ERDAL DEMİR referans cetvel doğrulaması.

Kullanıcı 7-sayfa örnek PDF'i referans olarak paylaştı. Bozuk holidays_import
kayıtları (2005-03-11 Ramazan Bayramı vb.) temizlendi ve FIFO algoritmasına
geri dönüldü. Bu test kullanıcının istediği 7 hak edişin doğru tam sayı
olarak kayda geçtiğini + normal izinlerin bölünmediğini doğrular.
"""
import os
import pytest
import httpx


BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/") + "/api"
ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}
ERDAL_PID = "17019646-53ff-421c-b442-8310c3ccfd67"


@pytest.fixture(scope="module")
def auth():
    r = httpx.post(f"{BASE}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_calc_leave_days_march_2005(auth):
    """07.03.2005-24.03.2005 = 14 iş günü (bozuk 2005-03-11 tatili temizlendi)."""
    r = httpx.post(f"{BASE}/leaves/preview", headers=auth,
                    json={"personnel_id": "x", "start_date": "2005-03-07",
                           "end_date": "2005-03-24", "izin_turu": "Yıllık"}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["days"] == 14.0, f"14 bekleniyor, {d['days']} bulundu"
    # Yalnızca hafta sonları sıfır olmalı
    for b in d["breakdown"]:
        if b["value"] == 0:
            assert b["reason"] == "Hafta sonu", f"Ekstra tatil: {b['date']} {b['reason']}"


def test_erdal_first_7_entitlements(auth):
    """PDF referansına göre ilk 7 hak ediş: 2004→2008 = 14, 2009-2010 = 20."""
    r = httpx.get(f"{BASE}/personnel/{ERDAL_PID}/izin-cetveli", headers=auth, timeout=30)
    assert r.status_code == 200
    allocs = r.json().get("allocations", [])
    from collections import defaultdict
    by_ent = defaultdict(float)
    for a in allocs:
        by_ent[a["entitlement_date"]] += a["days"]
    expected = {
        "2004-05-26": 14, "2005-05-26": 14, "2006-05-26": 14,
        "2007-05-26": 14, "2008-05-26": 14,
        "2009-05-26": 20, "2010-05-26": 20,
    }
    for ent, exp in expected.items():
        got = by_ent.get(ent)
        assert got == exp, f"{ent} beklenen={exp} bulunan={got}"


def test_no_split_for_normal_leaves(auth):
    """Kullanıcının 5 örnek izni bölünmez (14 tek satır)."""
    r = httpx.get(f"{BASE}/personnel/{ERDAL_PID}/izin-cetveli", headers=auth, timeout=30)
    allocs = r.json().get("allocations", [])
    from collections import defaultdict
    per_leave = defaultdict(list)
    for a in allocs:
        per_leave[a["leave_id"]].append(a)
    # ERDAL DEMİR test kayıtlarımız 2004-02-09, 2005-03-07, 2006-11-06 tarihli
    expected_single = {
        ("2004-02-09", "2004-02-26"),
        ("2005-03-07", "2005-03-24"),
        ("2006-11-06", "2006-11-23"),
    }
    for lid, slices in per_leave.items():
        s, e = slices[0]["start_date"], slices[0]["end_date"]
        if (s, e) in expected_single:
            assert len(slices) == 1, \
                f"Bölünmemeliydi {s}→{e}: {[(x['days'],x['entitlement_date']) for x in slices]}"
            assert slices[0]["days"] == 14
