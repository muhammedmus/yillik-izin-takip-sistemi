"""Iteration 72 — RABİA E2E: Gebelik/Doğum/Süt İzni Yaşam Döngüsü Regresyonu.

Test senaryosu (kullanıcı gereksinimi, Iter 67 spec):
  A) Tebliğ girildi → GEBE ÇALIŞAN
  B) Çalışamaz Raporu girildi → DOĞUM İZNİNDE
  C) Çocuk doğdu (işbaşı yok) → hâlâ DOĞUM İZNİNDE
  D) İlave ücretsiz izin girildi → hâlâ DOĞUM İZNİNDE
  E) İşbaşı girildi → SÜT İZNİ KULLANAN (kalan_gun >= 300)
  F) Çocuk 1 yaş+ (geçmişten) → SÜT İZNİ tamamlandı (hiçbir kartta yok)
"""
import os
from datetime import date, timedelta
import requests
import pytest


def _read_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None


BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env() or "").rstrip("/")
API = f"{BASE}/api"
ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}


@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def test_pid(sess):
    """RABİA-benzeri izole test personeli oluştur."""
    body = {
        "sicil_no": "RABIA-E2E",
        "ad": "RABIA", "soyad": "E2E",
        "ad_soyad": "RABIA E2E",
        "tc_no": "77777777777",
        "ise_giris": (date.today() - timedelta(days=365 * 3)).isoformat(),
        "departman": "TEST",
        "gorev": "İşçi",
        "cinsiyet": "K",
        "dogum_tarihi": "1990-01-01",
        "aktif": True,
    }
    r = sess.post(f"{API}/personnel", json=body, timeout=15)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    # cleanup
    sess.delete(f"{API}/personnel/{pid}",
                json={"password": ADMIN["password"], "reason": "iter72 cleanup"}, timeout=15)


def _find(items, pid):
    for it in items:
        if it.get("personnel_id") == pid:
            return it
    return None


def _panel(sess):
    return sess.get(f"{API}/special-leaves/status-panel", timeout=15).json()


def test_rabia_full_lifecycle(sess, test_pid):
    """Uçtan uca 6 senaryo — tek testte durum geçişleri kontrol edilir."""
    sid = None
    try:
        # ---------- A) Gebelik tebliği ----------
        teblig = (date.today() - timedelta(days=1)).isoformat()
        r = sess.post(f"{API}/special-leaves", json={
            "personnel_id": test_pid, "tur": "gebelik",
            "gebelik_teblig_tarihi": teblig, "start_date": teblig,
        }, timeout=15)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]

        p = _panel(sess)
        assert _find(p["gebe_calisan"]["items"], test_pid), "A) GEBE ÇALIŞAN'da olmalı"
        assert not _find(p["dogum_izninde"]["items"], test_pid)
        assert not _find(p["sut_izni_kullanan"]["items"], test_pid)

        # ---------- B) Çalışamaz raporu ----------
        crt_s = (date.today() - timedelta(days=5)).isoformat()
        crt_e = (date.today() + timedelta(days=50)).isoformat()
        r = sess.put(f"{API}/special-leaves/{sid}", json={
            "personnel_id": test_pid, "tur": "gebelik",
            "gebelik_teblig_tarihi": teblig,
            "calisamaz_rapor_tarihi": crt_s, "calisamaz_rapor_bitis": crt_e,
        }, timeout=15)
        assert r.status_code == 200
        p = _panel(sess)
        assert not _find(p["gebe_calisan"]["items"], test_pid), "B) GEBE'den çıkmış olmalı"
        it = _find(p["dogum_izninde"]["items"], test_pid)
        assert it, "B) DOĞUM İZNİNDE'de olmalı"
        assert it.get("rapor_gun_sayisi") == 56, f"B) rapor 56 gün olmalı: {it.get('rapor_gun_sayisi')}"

        # ---------- C) Çocuk doğdu (işbaşı yok) ----------
        cdob = (date.today() - timedelta(days=2)).isoformat()
        r = sess.put(f"{API}/special-leaves/{sid}", json={
            "personnel_id": test_pid, "tur": "gebelik",
            "gebelik_teblig_tarihi": teblig,
            "calisamaz_rapor_tarihi": crt_s, "calisamaz_rapor_bitis": crt_e,
            "cocuk_dogum_tarihi": cdob,
        }, timeout=15)
        assert r.status_code == 200
        p = _panel(sess)
        assert _find(p["dogum_izninde"]["items"], test_pid), "C) hâlâ DOĞUM İZNİNDE"
        assert not _find(p["sut_izni_kullanan"]["items"], test_pid)

        # ---------- D) İlave ücretsiz izin ----------
        ui_b = (date.today() + timedelta(days=51)).isoformat()
        ui_e = (date.today() + timedelta(days=112)).isoformat()
        r = sess.put(f"{API}/special-leaves/{sid}", json={
            "personnel_id": test_pid, "tur": "gebelik",
            "gebelik_teblig_tarihi": teblig,
            "calisamaz_rapor_tarihi": crt_s, "calisamaz_rapor_bitis": crt_e,
            "cocuk_dogum_tarihi": cdob,
            "ucretsiz_izin_baslangic": ui_b, "ucretsiz_izin_bitis": ui_e,
        }, timeout=15)
        assert r.status_code == 200
        p = _panel(sess)
        it = _find(p["dogum_izninde"]["items"], test_pid)
        assert it, "D) hâlâ DOĞUM İZNİNDE"
        assert it.get("ucretsiz_izin_gun_sayisi") == 62, (
            f"D) ücretsiz izin 62 gün olmalı: {it.get('ucretsiz_izin_gun_sayisi')}"
        )
        assert it.get("toplam_uzak_gun") == 56 + 62

        # ---------- E) İşbaşı (dün) ----------
        isbasi = (date.today() - timedelta(days=1)).isoformat()
        r = sess.put(f"{API}/special-leaves/{sid}", json={
            "personnel_id": test_pid, "tur": "gebelik",
            "gebelik_teblig_tarihi": teblig,
            "calisamaz_rapor_tarihi": crt_s, "calisamaz_rapor_bitis": crt_e,
            "cocuk_dogum_tarihi": cdob,
            "ucretsiz_izin_baslangic": ui_b, "ucretsiz_izin_bitis": ui_e,
            "dogum_sonrasi_isbasi": isbasi,
        }, timeout=15)
        assert r.status_code == 200
        p = _panel(sess)
        assert not _find(p["dogum_izninde"]["items"], test_pid), "E) DOĞUM'dan çıkmış olmalı"
        sut_it = _find(p["sut_izni_kullanan"]["items"], test_pid)
        assert sut_it, "E) SÜT İZNİ KULLANAN'da olmalı"
        # child_dob -2gün → 1 yıl → 365-2 = 363
        assert sut_it.get("kalan_gun") is not None
        assert sut_it.get("kalan_gun") >= 360, (
            f"E) kalan_gun ~363 olmalı: {sut_it.get('kalan_gun')}"
        )
        # sut_izni_bitis = child_dob + 1 yıl
        expected_bitis = (date.fromisoformat(cdob).replace(year=date.fromisoformat(cdob).year + 1)).isoformat()
        assert sut_it.get("sut_izni_bitis") == expected_bitis

        # ---------- F) Çocuk 1 yaş+ (geçmiş DOB) ----------
        old_cdob = (date.today() - timedelta(days=800)).isoformat()
        r = sess.put(f"{API}/special-leaves/{sid}", json={
            "personnel_id": test_pid, "tur": "gebelik",
            "gebelik_teblig_tarihi": teblig,
            "cocuk_dogum_tarihi": old_cdob,
            "dogum_sonrasi_isbasi": isbasi,
        }, timeout=15)
        assert r.status_code == 200
        p = _panel(sess)
        assert not _find(p["gebe_calisan"]["items"], test_pid), "F) hiçbir kartta olmamalı"
        assert not _find(p["dogum_izninde"]["items"], test_pid)
        assert not _find(p["sut_izni_kullanan"]["items"], test_pid)
    finally:
        if sid:
            sess.delete(f"{API}/special-leaves/{sid}", params={"reason": "iter72 cleanup"}, timeout=15)


def test_reject_legacy_types(sess, test_pid):
    """Iter 69: Yeni kayıtta dogum/sut_izni türü kabul edilmemeli."""
    for tur in ("dogum", "sut_izni"):
        r = sess.post(f"{API}/special-leaves", json={
            "personnel_id": test_pid, "tur": tur,
            "start_date": date.today().isoformat(),
        }, timeout=15)
        assert r.status_code == 400, f"{tur} için 400 beklenirdi: {r.status_code}"
        assert "artık desteklenmiyor" in r.text
