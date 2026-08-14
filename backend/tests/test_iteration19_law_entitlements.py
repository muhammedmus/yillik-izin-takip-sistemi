"""Iteration 19 — 4857 m.53 yıllık izin hak ediş kuralı testleri.

Doğrudan _days_for_seniority saf fonksiyonunu ve /personnel/{pid}/entitlements/recompute
endpoint'ini test eder. Amaç: ERDAL DEMİR (26.05.2003 / 12.02.1979 / prev=0) örneğinde
2004-2008 satırlarının 14 gün olduğunu ve toplam 514 günden kanun uygun toplama
düştüğünü doğrulamak.
"""
import os
import pytest
import httpx


BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/") + "/api"
ADMIN_EMAIL = "muhammedmus@gmail.com"
ADMIN_PASS = "Merkoteks2026!"


@pytest.fixture(scope="module")
def token():
    r = httpx.post(f"{BASE}/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- 1. Pure kanun kuralı (import _days_for_seniority) ----------
def test_law_days_pure():
    import sys, importlib
    sys.path.insert(0, "/app/backend")
    srv = importlib.import_module("server")
    f = srv._days_for_seniority
    # Kıdem sınırları — yaş 25 (istisna dışı)
    assert f(1, 25.0)[0] == 14
    assert f(4, 25.0)[0] == 14
    assert f(5, 25.0)[0] == 14           # 5 dahil = 14
    assert f(6, 25.0)[0] == 20
    assert f(14, 25.0)[0] == 20
    assert f(15, 25.0)[0] == 26          # 15 ve üzeri = 26
    assert f(16, 25.0)[0] == 26
    # Yaş <=18 kuralı
    assert f(1, 17.0)[0] == 20           # 17 yaş + 1 yıl kıdem → 20
    assert f(2, 18.0)[0] == 20           # 18 yaş + 2 yıl kıdem → 20
    assert f(2, 18.9)[0] == 20           # 18.9 yaş hâlâ 18'in içinde
    assert f(2, 19.0)[0] == 14           # 19 yaş + 2 yıl → 14
    # Yaş >=50 kuralı
    assert f(2, 49.0)[0] == 14
    assert f(2, 50.0)[0] == 20           # 50 yaş dahil
    assert f(16, 55.0)[0] == 26          # kıdem zaten 26 verirse aşağı çekmez
    # Genç işçi kıdemle beraber
    assert f(6, 17.0)[0] == 20           # base=20, age=20 → 20
    assert f(16, 17.0)[0] == 26


# ---------- 2. Recompute endpoint — ERDAL DEMİR (canlı DB) ----------
def _get_erdal_id(auth):
    r = httpx.get(f"{BASE}/personnel?q=ERDAL", headers=auth, timeout=30)
    assert r.status_code == 200
    payload = r.json()
    items = payload if isinstance(payload, list) else payload.get("items", [])
    for p in items:
        if p.get("ise_giris") == "2003-05-26" and p.get("dogum_tarihi") == "1979-02-12":
            return p["id"]
    pytest.skip("ERDAL DEMİR örneği bulunamadı")


def test_recompute_erdal(auth):
    pid = _get_erdal_id(auth)
    r = httpx.post(f"{BASE}/personnel/{pid}/entitlements/recompute",
                   headers=auth, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ise_giris"] == "2003-05-26"
    assert data["dogum_tarihi"] == "1979-02-12"
    assert data["onceki_kidem_yil"] == 0
    ents = data["entitlements"]
    assert len(ents) >= 22, f"En az 22 satır bekleniyor, bulundu {len(ents)}"

    # 2004..2008 = 14 gün (kıdem 1..5)
    by_date = {e["entitlement_date"]: e for e in ents}
    for iso in ["2004-05-26", "2005-05-26", "2006-05-26", "2007-05-26", "2008-05-26"]:
        e = by_date[iso]
        assert e["entitlement_days"] == 14, f"{iso} 14 olmalı, {e['entitlement_days']}"
        assert e["previous_seniority"] == 0
    # 2009 = 20 (kıdem 6)
    assert by_date["2009-05-26"]["entitlement_days"] == 20
    # 15+ yıl kıdem → 26 gün
    assert by_date["2018-05-26"]["entitlement_days"] == 26   # yıl 15
    assert by_date["2019-05-26"]["entitlement_days"] == 26   # yıl 16

    # Toplam (2004..2026 = 23 satır) — beklenen: 5×14 + 9×20 + 9×26 = 484
    expected_total = 5 * 14 + 9 * 20 + 9 * 26
    assert data["new_total"] == expected_total, \
        f"YENİ toplam {expected_total} bekleniyor, {data['new_total']}"


def test_balance_after_recompute(auth):
    """Recompute sonrası /personnel/{pid}/balance de aynı toplamı vermeli."""
    pid = _get_erdal_id(auth)
    httpx.post(f"{BASE}/personnel/{pid}/entitlements/recompute", headers=auth, timeout=60)
    r = httpx.get(f"{BASE}/personnel/{pid}/balance", headers=auth, timeout=30)
    assert r.status_code == 200
    bal = r.json()["balance"]
    expected_total = 5 * 14 + 9 * 20 + 9 * 26
    assert bal["entitled_total"] == expected_total, bal
    # 2004..2008 hepsi 14 gün (yeni balance shape: entitlements[])
    year_map = {x["date"]: x["days"] for x in bal["entitlements"]}
    for iso in ["2004-05-26", "2005-05-26", "2006-05-26", "2007-05-26", "2008-05-26"]:
        assert year_map[iso] == 14, f"{iso} = {year_map.get(iso)} (14 olmalı)"


def test_admin_only(auth):
    """Recompute endpoint sadece admin — anonymous / bad-token 401/403 dönmeli."""
    r = httpx.post(f"{BASE}/personnel/fake-id/entitlements/recompute", timeout=30)
    assert r.status_code in (401, 403)


def test_recompute_404(auth):
    r = httpx.post(f"{BASE}/personnel/nonexistent-id/entitlements/recompute",
                   headers=auth, timeout=30)
    assert r.status_code == 404
