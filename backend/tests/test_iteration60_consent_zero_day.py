"""Iteration 60 — Muvafakatname consent_required 0 gün + bakiye YOK senaryoları.

Test senaryoları (kullanıcı gereksinimi):
A) Bugün · days=0 · bakiye 0 → consent_required=True
B) Bugün · days=0 · bakiye pozitif → consent_required=False
C) Bugün · days>0 · bakiye 0 → consent_required=True
D) Geçmiş tarihli avans izin → frontend filtresi olduğu için ayrıca test edilir (created_at != bugün)
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


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env() or "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}


@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200
    tok = r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def _make_personnel(sess, sicil, ise_giris):
    """İşe giriş tarihine göre otomatik hak ediş oluşturulur.
    Not: entitlements koleksiyonu ancak /balance çağrıldığında persist edilir.
    Bu yüzden create sonrası balance'ı bir kez çekiyoruz (frontend de bunu yapar).
    """
    body = {
        "sicil_no": sicil,
        "ad": "Muvafakat", "soyad": f"Test{sicil}",
        "ad_soyad": f"MUVAFAKAT TEST{sicil}",
        "tc_no": f"11{sicil}00000",
        "ise_giris": ise_giris,
        "departman": "TEST",
        "gorev": "İşçi",
        "cinsiyet": "E",
        "dogum_tarihi": "1990-01-01",
        "aktif": True,
    }
    r = sess.post(f"{API}/personnel", json=body, timeout=15)
    assert r.status_code == 200, f"personnel create failed: {r.text}"
    pid = r.json()["id"]
    # Entitlement satırlarının persist edilmesi için balance'ı bir kez çek.
    sess.get(f"{API}/personnel/{pid}/balance", timeout=15)
    return pid


def _cleanup_personnel(sess, pid):
    sess.delete(f"{API}/personnel/{pid}", json={"password": ADMIN["password"], "reason": "iter60 test cleanup"}, timeout=15)


def _get_leave_consent(sess, pid, lid):
    r = sess.get(f"{API}/leaves", params={"personnel_id": pid, "include_consent": "true"}, timeout=15)
    assert r.status_code == 200
    for L in r.json():
        if L["id"] == lid:
            return L
    return None


def test_A_zero_day_zero_balance(sess):
    """A) Bugün · days=0 · bakiye 0 → consent_required=True"""
    # 1 gün önce işe girmiş — hak ediş henüz yok (entitled_so_far=0).
    pid = _make_personnel(sess, "MVF-A", (date.today() - timedelta(days=1)).isoformat())
    try:
        today = date.today().isoformat()
        r = sess.post(f"{API}/leaves", json={
            "personnel_id": pid, "start_date": today, "end_date": today,
            "izin_turu": "Yıllık İzin", "aciklama": "iter60 case A",
        }, timeout=15)
        # 0 gün oluşabilmesi için start_date = end_date olmalı. Backend hesaplar.
        # calc_leave_days'e göre 1 iş günü hesaplanabilir; bu yüzden days=0 senaryosunu
        # doğrudan DB'ye 0 gün olarak yazamayız. Bunun yerine backend zaten hafta sonu
        # veya tatilse 0 döndürebilir. Test için hafta sonu tarihi seçelim.
        # Testin öz amacı: consent_required'ın 0 günde de doğru davranmasını doğrulamak.
        # Manuel olarak days=0 update edelim.
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        # DB'de days=0 yap
        from pymongo import MongoClient
        m = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        m[os.environ.get("DB_NAME", "merkoteks_hr")]["leaves"].update_one(
            {"id": lid}, {"$set": {"days": 0}})
        m.close()
        L = _get_leave_consent(sess, pid, lid)
        assert L is not None, "izin bulunamadı"
        assert L["days"] == 0, f"days sıfır olmalı, geldi: {L['days']}"
        assert L["consent_required"] is True, (
            "A) 0 gün + bakiye 0 → consent_required=True olmalı, "
            f"geldi: {L['consent_required']}"
        )
    finally:
        _cleanup_personnel(sess, pid)


def test_B_zero_day_positive_balance(sess):
    """B) Bugün · days=0 · bakiye pozitif → consent_required=False"""
    # 5+ yıl önce işe girmiş — birden fazla hak ediş var.
    pid = _make_personnel(sess, "MVF-B", (date.today() - timedelta(days=5 * 365 + 10)).isoformat())
    try:
        today = date.today().isoformat()
        r = sess.post(f"{API}/leaves", json={
            "personnel_id": pid, "start_date": today, "end_date": today,
            "izin_turu": "Yıllık İzin", "aciklama": "iter60 case B",
        }, timeout=15)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        from pymongo import MongoClient
        m = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        m[os.environ.get("DB_NAME", "merkoteks_hr")]["leaves"].update_one(
            {"id": lid}, {"$set": {"days": 0}})
        m.close()
        # Bakiyeyi çek
        bal = sess.get(f"{API}/personnel/{pid}/balance", timeout=15).json()["balance"]
        assert bal["remaining"] > 0, f"bakiye pozitif olmalı: {bal}"
        L = _get_leave_consent(sess, pid, lid)
        assert L is not None
        assert L["days"] == 0
        assert L["consent_required"] is False, (
            "B) 0 gün + bakiye pozitif → consent_required=False olmalı, "
            f"geldi: {L['consent_required']} bakiye={bal['remaining']}"
        )
    finally:
        _cleanup_personnel(sess, pid)


def test_C_positive_days_zero_balance(sess):
    """C) Bugün · days>0 · bakiye 0 → consent_required=True"""
    pid = _make_personnel(sess, "MVF-C", (date.today() - timedelta(days=1)).isoformat())
    try:
        # 4 iş günü kapsayacak bir aralık: bugünden 6 gün sonra (hafta arası bulur)
        s_d = date.today() + timedelta(days=7)
        # Pazartesi olacak şekilde ayarla
        s_d = s_d + timedelta(days=(7 - s_d.weekday()) % 7)  # Pazartesi
        e_d = s_d + timedelta(days=3)  # Perşembe → 4 iş günü
        r = sess.post(f"{API}/leaves", json={
            "personnel_id": pid, "start_date": s_d.isoformat(), "end_date": e_d.isoformat(),
            "izin_turu": "Yıllık İzin", "aciklama": "iter60 case C",
        }, timeout=15)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        L = _get_leave_consent(sess, pid, lid)
        assert L is not None
        assert L["days"] >= 1, f"days > 0 olmalı: {L['days']}"
        assert L["consent_required"] is True, (
            f"C) days>0 + bakiye 0 → True olmalı, geldi: {L['consent_required']}"
        )
    finally:
        _cleanup_personnel(sess, pid)


def test_D_regression_normal_case_no_consent(sess):
    """Regresyon: bakiye yeterli olan normal izin muvafakatname gerektirmez."""
    pid = _make_personnel(sess, "MVF-D", (date.today() - timedelta(days=5 * 365 + 10)).isoformat())
    try:
        s_d = date.today() + timedelta(days=7)
        s_d = s_d + timedelta(days=(7 - s_d.weekday()) % 7)
        e_d = s_d + timedelta(days=2)  # 3 iş günü
        r = sess.post(f"{API}/leaves", json={
            "personnel_id": pid, "start_date": s_d.isoformat(), "end_date": e_d.isoformat(),
            "izin_turu": "Yıllık İzin", "aciklama": "iter60 regression",
        }, timeout=15)
        assert r.status_code == 200
        lid = r.json()["id"]
        L = _get_leave_consent(sess, pid, lid)
        assert L is not None
        assert L["consent_required"] is False, (
            f"Regresyon: bakiye yeterli iken consent_required=False olmalı, "
            f"geldi: {L['consent_required']}"
        )
    finally:
        _cleanup_personnel(sess, pid)


def test_E_over_balance_still_triggers(sess):
    """Regresyon: bakiyeyi aşan izin muvafakatname gerektirir (mevcut kural)."""
    pid = _make_personnel(sess, "MVF-E", (date.today() - timedelta(days=1)).isoformat())
    try:
        s_d = date.today() + timedelta(days=7)
        s_d = s_d + timedelta(days=(7 - s_d.weekday()) % 7)
        e_d = s_d + timedelta(days=4)  # 5 iş günü
        r = sess.post(f"{API}/leaves", json={
            "personnel_id": pid, "start_date": s_d.isoformat(), "end_date": e_d.isoformat(),
            "izin_turu": "Yıllık İzin", "aciklama": "iter60 over",
        }, timeout=15)
        assert r.status_code == 200
        lid = r.json()["id"]
        L = _get_leave_consent(sess, pid, lid)
        assert L is not None
        assert L["consent_required"] is True
        assert L["consent_advance_days"] >= 1
    finally:
        _cleanup_personnel(sess, pid)
