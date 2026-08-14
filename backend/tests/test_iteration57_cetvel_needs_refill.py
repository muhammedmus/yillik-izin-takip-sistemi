"""Iteration 57 — Cetvel needs_refill bayrağı regresyonu.

Kapsam:
- cetvel-mark sonrası personel bayrakları temiz.
- Yeni izin girişi → cetvel_generated_at unset, cetvel_needs_refill=True (sadece
  cetveli daha önce oluşturulmuş personel için).
- Cetveli hiç mark edilmemiş personelde yeni izin needs_refill üretmez.
- Cetveli tekrar mark edildiğinde needs_refill bayrağı temizlenir.
- cetvel-unmark de bayrağı temizler.
"""
import os
from datetime import date, timedelta
import requests
import pytest


def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
API = f"{BASE_URL}/api"
ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}


@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code}"
    tok = r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def _get_flags(sess, pid):
    r = sess.get(f"{API}/personnel/{pid}/balance", timeout=15)
    assert r.status_code == 200
    p = r.json()["personnel"]
    return p.get("cetvel_generated_at"), p.get("cetvel_needs_refill")


def _pick_personnel(sess):
    r = sess.get(f"{API}/personnel", params={"limit": 5, "aktif": True}, timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert lst, "En az bir aktif personel gerekli"
    return lst[0]["id"]


def test_cetvel_needs_refill_flow(sess):
    pid = _pick_personnel(sess)

    # Baseline: temizle (varsa)
    sess.post(f"{API}/personnel/{pid}/cetvel-unmark", timeout=15)

    # 1) cetvel-mark
    r = sess.post(f"{API}/personnel/{pid}/cetvel-mark", timeout=15)
    assert r.status_code == 200
    gen, refill = _get_flags(sess, pid)
    assert gen, "cetvel_generated_at set olmalı"
    assert not refill, "needs_refill başlangıçta olmamalı"

    # 2) Yeni izin ekle
    d1 = date.today().isoformat()
    d2 = (date.today() + timedelta(days=1)).isoformat()
    r = sess.post(
        f"{API}/leaves",
        json={"personnel_id": pid, "start_date": d1, "end_date": d2,
              "izin_turu": "Yıllık İzin", "aciklama": "iter57 test"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    leave_id = r.json()["id"]

    try:
        gen, refill = _get_flags(sess, pid)
        assert gen is None, f"cetvel_generated_at unset olmalı, geldi: {gen}"
        assert refill is True, f"needs_refill=True olmalı, geldi: {refill}"

        # 3) Tekrar mark → temizlenir
        r = sess.post(f"{API}/personnel/{pid}/cetvel-mark", timeout=15)
        assert r.status_code == 200
        gen, refill = _get_flags(sess, pid)
        assert gen, "yeniden mark sonrası set olmalı"
        assert not refill, "yeniden mark sonrası needs_refill temizlenmeli"

        # 4) unmark da temizler
        sess.post(f"{API}/personnel/{pid}/cetvel-unmark", timeout=15)
        gen, refill = _get_flags(sess, pid)
        assert gen is None
        assert not refill
    finally:
        # cleanup
        sess.delete(f"{API}/leaves/{leave_id}", timeout=15)
        sess.post(f"{API}/personnel/{pid}/cetvel-unmark", timeout=15)


def test_cetvel_needs_refill_repeated_cycles(sess):
    """Iter 58: mark→izin→mark→izin→mark döngüsü. Her yeni izin sonrası uyarı
    tekrar tetiklenmeli, her cetvel-mark sonrası uyarı sıfırlanmalı."""
    pid = _pick_personnel(sess)
    sess.post(f"{API}/personnel/{pid}/cetvel-unmark", timeout=15)  # baseline
    leave_ids = []
    try:
        for i in range(3):
            # Cetveli işaretle
            r = sess.post(f"{API}/personnel/{pid}/cetvel-mark", timeout=15)
            assert r.status_code == 200, f"cycle {i} mark failed"
            gen, refill = _get_flags(sess, pid)
            assert gen, f"cycle {i}: mark sonrası generated_at set olmalı"
            assert not refill, f"cycle {i}: mark sonrası needs_refill temiz olmalı"

            # Yeni izin ekle — döngüde çakışmayacak farklı tarihler
            d1 = (date.today() + timedelta(days=30 + i * 3)).isoformat()
            d2 = (date.today() + timedelta(days=31 + i * 3)).isoformat()
            r = sess.post(
                f"{API}/leaves",
                json={"personnel_id": pid, "start_date": d1, "end_date": d2,
                      "izin_turu": "Yıllık İzin", "aciklama": f"iter58 cycle {i}"},
                timeout=15,
            )
            assert r.status_code == 200, f"cycle {i} leave create failed: {r.text}"
            leave_ids.append(r.json()["id"])

            gen, refill = _get_flags(sess, pid)
            assert gen is None, f"cycle {i}: yeni izin sonrası generated_at unset olmalı"
            assert refill is True, (
                f"cycle {i}: her yeni izin sonrası needs_refill=True olmalı, geldi: {refill}"
            )
    finally:
        for lid in leave_ids:
            sess.delete(f"{API}/leaves/{lid}", timeout=15)
        sess.post(f"{API}/personnel/{pid}/cetvel-unmark", timeout=15)


def test_no_refill_for_never_marked_personnel(sess):
    """Cetveli hiç mark edilmemiş personelde yeni izin needs_refill üretmemeli."""
    pid = _pick_personnel(sess)
    sess.post(f"{API}/personnel/{pid}/cetvel-unmark", timeout=15)  # baseline temiz
    gen, refill = _get_flags(sess, pid)
    assert gen is None
    assert not refill

    d1 = date.today().isoformat()
    d2 = (date.today() + timedelta(days=1)).isoformat()
    r = sess.post(
        f"{API}/leaves",
        json={"personnel_id": pid, "start_date": d1, "end_date": d2,
              "izin_turu": "Yıllık İzin", "aciklama": "iter57 no-mark test"},
        timeout=15,
    )
    assert r.status_code == 200
    leave_id = r.json()["id"]

    try:
        gen, refill = _get_flags(sess, pid)
        assert gen is None
        assert refill is None or refill is False, (
            f"Cetveli hiç mark edilmemişse needs_refill set edilmemeli, geldi: {refill}"
        )
    finally:
        sess.delete(f"{API}/leaves/{leave_id}", timeout=15)
