"""Tests for _ten_day_check_from_leaves — YILLIK bazlı 3-durumlu mantık.

- earned_ok  : Bu yıl hak edilmiş bakiyeden 10+ günlük tek parça yıllık izin
- advance_ok : Bu yıl hak edişsiz/avans 10+ günlük tek parça yıllık izin
- missing    : Bu yıl 10+ günlük tek parça yıllık izin yok

Kural: sadece today.year içindeki izinler değerlendirilir; geçmiş yıllar
etkilemez (1 Ocak'ta sıfırlanır).
"""
from datetime import date
from server import _ten_day_check_from_leaves


def L(start, days, tur="Yıllık İzin"):
    return {"start_date": start, "days": days, "izin_turu": tur}


# --- Kullanıcı örnekleri A–F ---------------------------------------------

def test_A_earned_ok_2026_14day_with_entitlement():
    today = date(2026, 8, 12)
    ents = [{"date": "2024-06-01"}, {"date": "2025-06-01"}]
    leaves = [L("2026-06-15", 14)]
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "earned_ok"
    assert r["year"] == 2026
    assert r["max_slice_days"] == 14.0


def test_B_advance_ok_2026_10day_no_entitlement():
    today = date(2026, 8, 12)
    ents = []
    leaves = [L("2026-07-01", 10)]
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "advance_ok"
    assert r["year"] == 2026


def test_C_missing_2026_5_plus_5_with_entitlement():
    today = date(2026, 8, 12)
    ents = [{"date": "2024-06-01"}]
    leaves = [L("2026-03-01", 5), L("2026-06-01", 5)]
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "missing"


def test_D_missing_2026_7_plus_7():
    today = date(2026, 8, 12)
    ents = [{"date": "2024-06-01"}]
    leaves = [L("2026-02-01", 7), L("2026-08-01", 7)]
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "missing"


def test_E_prev_year_20day_does_not_carry_to_current():
    """Örnek E: 2025'te 20 gün kullandı, 2026'da hiç 10+ yok → 2026'da KIRMIZI."""
    today = date(2026, 8, 12)
    ents = [{"date": "2024-06-01"}]
    leaves = [L("2025-05-01", 20)]  # Sadece geçen yıl
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "missing"
    assert r["year"] == 2026


def test_F_advance_then_earned_same_year_wins_green():
    """Örnek F: 2026'da önce 10 gün avans, sonra 14 gün earned → YEŞİL."""
    today = date(2026, 8, 12)
    ents = [{"date": "2026-06-01"}]
    leaves = [L("2026-03-01", 10),   # avans (hak ediş yok)
              L("2026-08-01", 14)]   # earned
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "earned_ok"
    assert r["earned_big_count"] == 1
    assert r["advance_big_count"] == 1


# --- Ek doğrulamalar -----------------------------------------------------

def test_10_5_days_counts_as_10_plus():
    today = date(2026, 8, 12)
    ents = [{"date": "2024-06-01"}]
    r = _ten_day_check_from_leaves(ents, None, [L("2026-04-01", 10.5)], today)
    assert r["status"] == "earned_ok"


def test_9_5_days_not_enough():
    today = date(2026, 8, 12)
    ents = [{"date": "2024-06-01"}]
    r = _ten_day_check_from_leaves(ents, None, [L("2026-04-01", 9.5)], today)
    assert r["status"] == "missing"


def test_special_leaves_ignored_even_if_20_days():
    today = date(2026, 8, 12)
    ents = [{"date": "2024-06-01"}]
    leaves = [L("2026-05-01", 14, tur="Evlilik İzni"),
              L("2026-06-01", 20, tur="Ücretsiz İzin"),
              L("2026-07-01", 3, tur="Süt İzni")]
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "missing"


def test_no_leaves_at_all():
    today = date(2026, 8, 12)
    ents = [{"date": "2024-06-01"}]
    r = _ten_day_check_from_leaves(ents, None, [], today)
    assert r["status"] == "missing"
    assert r["max_slice_days"] == 0.0


# --- 2027 regresyonu -----------------------------------------------------

def test_2027_resets_when_no_new_10plus_yet():
    """2026'da 14 gün earned. 2027'e girdik ama henüz 10+ yok → KIRMIZI."""
    today = date(2027, 3, 1)
    ents = [{"date": "2024-06-01"}]
    leaves = [L("2026-08-01", 14), L("2027-02-10", 5)]
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "missing"
    assert r["year"] == 2027


def test_2027_advance_10_only_gives_yellow():
    today = date(2027, 6, 1)
    ents = []  # Hâlâ hak ediş yok (yeni personel gibi)
    leaves = [L("2026-08-01", 14), L("2027-04-01", 12)]
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "advance_ok"
    assert r["year"] == 2027


def test_2027_earned_10plus_gives_green():
    today = date(2027, 6, 1)
    ents = [{"date": "2024-06-01"}]
    leaves = [L("2026-08-01", 14), L("2027-04-01", 12)]
    r = _ten_day_check_from_leaves(ents, None, leaves, today)
    assert r["status"] == "earned_ok"


def test_year_boundary_dec31_included_jan1_next_year_excluded():
    """Yıl sınırında start_date filtresi doğru mu?"""
    today = date(2026, 8, 12)
    ents = [{"date": "2024-06-01"}]
    # 2025-12-31 başlangıçlı 12 günlük izin 2026 kontrolüne girmemeli
    r1 = _ten_day_check_from_leaves(ents, None, [L("2025-12-31", 12)], today)
    assert r1["status"] == "missing"
    # 2026-01-01 başlangıçlı 12 günlük izin 2026 kontrolüne girmeli
    r2 = _ten_day_check_from_leaves(ents, None, [L("2026-01-01", 12)], today)
    assert r2["status"] == "earned_ok"


def test_advance_when_leave_before_entitlement_but_same_year():
    """Ent: 2026-06-01. Leave: 2026-03-01, 12 gün. → advance_ok (izin başlangıcında ent yok)."""
    today = date(2026, 8, 12)
    ents = [{"date": "2026-06-01"}]
    r = _ten_day_check_from_leaves(ents, None, [L("2026-03-01", 12)], today)
    assert r["status"] == "advance_ok"


def test_all_active_personnel_get_a_status_never_none():
    """Ne olursa olsun sonuç 'earned_ok' | 'advance_ok' | 'missing' — hiçbir zaman None/boş."""
    today = date(2026, 8, 12)
    valid = {"earned_ok", "advance_ok", "missing"}
    scenarios = [
        ([], []),
        ([{"date": "2024-01-01"}], []),
        ([], [L("2026-06-01", 10)]),
        ([{"date": "2020-01-01"}], [L("2026-06-01", 14)]),
        ([{"date": "2020-01-01"}], [L("2026-06-01", 9.5)]),
        ([{"date": "2020-01-01"}], [L("2025-06-01", 20)]),  # geçen yıl
    ]
    for ents, leaves in scenarios:
        r = _ten_day_check_from_leaves(ents, None, leaves, today)
        assert r["status"] in valid, r
