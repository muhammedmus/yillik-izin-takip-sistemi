"""Iteration 22 — DEPRECATED (Iter 24 sonrası).

Iter 22 period-based attribution kuralı Iter 24'te KULLANICI İSTEĞİYLE geri alındı.
Bakınız /app/memory/PRD.md → "Iteration 24" bölümü:

    "FIFO algoritması geri yüklendi (Iter 22'de period-based yaptığım değişiklik
    geri alındı) — kullanıcı gerçek bakiye devir/geçiş dağıtımı için FIFO'yu
    istedi (17+3, 3+17, 2,5+11,5 gibi)."

Yeni referans doğruluk testleri /app/backend/tests/test_iteration24_erdal_reference.py
içinde canlı ERDAL DEMİR referans PDF'iyle karşılaştırma yapıyor.

Bu dosya bilerek boş bırakıldı — koleksiyondan çıkarılmadan içeriği devre dışı
tutuldu ki geçmiş test raporları bozulmasın.
"""
import pytest


@pytest.mark.skip(reason="Iter 24 sonrası FIFO davranışı geri getirildi — bu test Iter 22 period-based kuralına dayanıyordu ve artık geçerli değildir.")
def test_deprecated_period_based_allocation():
    pass
