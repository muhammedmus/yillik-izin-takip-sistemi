# -*- coding: utf-8 -*-
"""
IZIN KAYITLARI - GUNLUK DOSYALAR + GUNCEL YILLIK IZIN (TEK, EKLEMELI)
=========================================================================
server.py ile AYNI container icinde calisir; tatil/donus tarihi hesabini
dogrudan server.py'den import ederek yapar (tekrar/uyumsuzluk riski olmaz).

URETILEN DOSYALAR (container icinde /tmp altinda, bat script host'a kopyalar):

  1) GUNLUK DOSYA (her gun ayri, dosya adinda o gunun tarihi var):
     /tmp/gunluk_izinler/Gunluk_Izin_<YYYY-MM-DD>.xlsx
     - Sadece O GUN olusturulmus (created_at) izin kayitlarini icerir.
     - Sadece o gun yeni kayit varsa olusturulur.

  2) GUNCEL YILLIK IZIN (TEK dosya, kalici, her calistirmada icerigi
     GUNCELLENIR - sifirdan yeniden YAZILMAZ, sadece henuz eklenmemis
     yeni kayitlar en USTE eklenir):
     /tmp/Guncel_Yillik_Izin.xlsx

Her iki dosyada da kolonlar (soldan saga):
  Sicil No | Ad Soyad | Izin Baslangic | Izin Bitis | Izin Donus |
  Gun Sayisi | Kaydi Olusturan
(+ gizli "Kayit ID" kolonu - sadece tekrar eklemeyi onlemek icin, Guncel
  Yillik Izin dosyasinda kullanilir)
"""
import asyncio
import os
import smtplib
import sys
from datetime import date, datetime, timedelta, timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

# server.py'nin bulundugu klasoru path'e ekle ve gercek fonksiyonlarini kullan
sys.path.insert(0, "/app")
from server import db, get_all_holidays, _next_working_day, _resolve_isbasi  # noqa: E402

# Turkiye UTC+3 (DST kullanmiyor - sabit ofset yeterli ve guvenilir).
TR_TZ = timezone(timedelta(hours=3))


def to_tr_date_str(iso_str: str) -> str:
    """ISO 8601 zaman damgasini (created_at genelde UTC olarak saklanir) Turkiye
    yerel tarihine (YYYY-MM-DD) cevirir. 09.09.2026 hatasinin kok sebebi buydu:
    eskiden created_at'in UTC tarih ONEKI dogrudan (Turkiye yerel gunuyle
    karsilastirmadan) kontrol ediliyordu. Turkiye UTC+3 oldugu icin, gece
    yarisi ile saat 03:00 arasinda (Turkiye saati) girilen bir kayit UTC'de
    hala BIR ONCEKI GUNE ait gorunuyordu - bu da o kaydin "bugunun kaydi"
    olarak hic yakalanmamasina, dolayisiyla mail'in hic gonderilmemesine yol
    aciyordu."""
    if not iso_str:
        return ""
    try:
        s = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(TR_TZ).strftime("%Y-%m-%d")
    except Exception:
        return ""

MASTER_PATH = "/tmp/Guncel_Yillik_Izin.xlsx"
DAILY_DIR = "/tmp/gunluk_izinler"
SHEET_NAME = "Izin_Kayitlari"

# Gorunur kolonlar (Kayit ID en sonda ve gizli - sadece master dosyada kullanilir)
COLUMNS = [
    ("Sicil No", 12),
    ("Ad Soyad", 26),
    ("Izin Baslangic", 15),
    ("Izin Bitis", 15),
    ("Izin Donus", 15),
    ("Gun Sayisi", 11),
    ("Kaydi Olusturan", 22),
]
ID_COL_INDEX = len(COLUMNS) + 1  # sadece master dosyada eklenir


def to_tr_date(iso_str):
    if not iso_str:
        return ""
    try:
        d = iso_str[:10].split("-")
        return f"{d[2]}.{d[1]}.{d[0]}"
    except Exception:
        return iso_str


def style_header(ws, with_id_col: bool):
    header_fill = PatternFill(start_color="1D4ED8", end_color="1D4ED8", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    cols = COLUMNS + ([("Kayit ID", 10)] if with_id_col else [])
    for col_idx, (title, width) in enumerate(cols, start=1):
        cell = ws.cell(row=1, column=col_idx, value=title)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.column_dimensions[get_column_letter(col_idx)].width = width
    ws.freeze_panes = "A2"
    if with_id_col:
        ws.column_dimensions[get_column_letter(ID_COL_INDEX)].hidden = True


async def build_row(L, personnel_map, user_map, holidays):
    p = personnel_map.get(L.get("personnel_id"), {})
    u = user_map.get(L.get("created_by"), {})
    donus = ""
    try:
        isbasi_str = _resolve_isbasi(L, holidays)
        donus = to_tr_date(isbasi_str) if isbasi_str else ""
    except Exception:
        donus = ""
    row = [
        p.get("sicil_no", "—"),
        p.get("ad_soyad", "—"),
        to_tr_date(L.get("start_date")),
        to_tr_date(L.get("end_date")),
        donus,
        L.get("days", ""),
        u.get("name", "—"),
    ]
    return row


def send_daily_report_email(attachment_path: str, record_count: int, day_str: str) -> None:
    """Guncel Yillik Izin dosyasini (tum kayitlar) ek olarak SMTP ile gonderir —
    sadece o gun yeni izin kaydi girildiyse cagrilir. .env icinde SMTP_HOST/
    SMTP_PORT/SMTP_USER/SMTP_PASSWORD/DAILY_REPORT_EMAIL tanimli degilse
    sessizce atlar (mail gonderimi opsiyoneldir, rapor uretimini engellemez)."""
    host = os.environ.get("SMTP_HOST")
    port = os.environ.get("SMTP_PORT")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    recipient = os.environ.get("DAILY_REPORT_EMAIL")

    if not all([host, port, user, password, recipient]):
        print("BILGI: SMTP ayarlari (.env) eksik, mail gonderimi atlandi.")
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = user
        msg["To"] = recipient
        msg["Subject"] = f"Guncel Yillik Izin Kayitlari — {day_str} ({record_count} yeni kayit)"
        body = (
            f"Merhaba,\n\n"
            f"{day_str} tarihinde {record_count} adet yeni yillik izin kaydi "
            f"islenmistir. Sistemdeki TUM izin kayitlarini iceren guncel liste "
            f"ekte yer almaktadir.\n\n"
            f"Bu e-posta Personel Izin Takip Sistemi tarafindan otomatik olarak "
            f"gonderilmistir.\n"
        )
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with open(attachment_path, "rb") as f:
            part = MIMEApplication(f.read(), Name=os.path.basename(attachment_path))
        part["Content-Disposition"] = f'attachment; filename="{os.path.basename(attachment_path)}"'
        msg.attach(part)

        with smtplib.SMTP(host, int(port), timeout=30) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(user, [recipient], msg.as_string())

        print(f"OK: Mail gonderildi -> {recipient}")
    except Exception as e:
        print(f"HATA: Mail gonderilemedi -> {e}")


async def main():
    holidays = await get_all_holidays()

    all_leaves = await db.leaves.find({}).sort("created_at", -1).to_list(None)

    personnel_ids = list({L.get("personnel_id") for L in all_leaves if L.get("personnel_id")})
    user_ids = list({L.get("created_by") for L in all_leaves if L.get("created_by")})
    personnel_map, user_map = {}, {}
    if personnel_ids:
        async for p in db.personnel.find({"id": {"$in": personnel_ids}}, {"_id": 0}):
            personnel_map[p["id"]] = p
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0}):
            user_map[u["id"]] = u

    # ---------------------------------------------------------------
    # 1) GUNCEL YILLIK IZIN — tek, kalici dosya. Yeni kayitlari basa ekler,
    #    veritabanindan SILINMIS kayitlarin satirini da dosyadan kaldirir
    #    (aksi halde silinen bir izin dosyada kalicilasir).
    # ---------------------------------------------------------------
    existing_rows = []  # [(kayit_id, [gorunur_deger, ...]) , ...] dosyadaki mevcut sira ile
    if os.path.exists(MASTER_PATH):
        wb = load_workbook(MASTER_PATH)
        ws = wb[SHEET_NAME] if SHEET_NAME in wb.sheetnames else wb.active
        for row in ws.iter_rows(min_row=2, values_only=False):
            try:
                id_cell = row[ID_COL_INDEX - 1]
                rid = str(id_cell.value) if id_cell.value else None
            except IndexError:
                rid = None  # eski formatli dosya - bu satirin ID'si bilinmiyor
            if rid:
                values = [c.value for c in row[:ID_COL_INDEX]]
                existing_rows.append((rid, values))
    else:
        wb = Workbook()
        ws = wb.active
        ws.title = SHEET_NAME
        style_header(ws, with_id_col=True)

    current_ids = {str(L.get("id", "")) for L in all_leaves}
    # Veritabaninda artik olmayan (silinmis) kayitlarin satirlarini eleme
    kept_rows = [(rid, values) for rid, values in existing_rows if rid in current_ids]
    removed_count = len(existing_rows) - len(kept_rows)
    kept_ids = {rid for rid, _ in kept_rows}

    # Dosyada zaten olan kayitlari veritabanindaki GUNCEL haliyle yenile.
    # (Eskiden sadece yeni kayitlar ekleniyordu; bir iznin tarihi sonradan
    # duzeltildiginde dosyada eski tarih kaliyordu.) Siralama korunur.
    leaves_by_id = {str(L.get("id", "")): L for L in all_leaves}
    refreshed_rows = []
    updated_count = 0
    for rid, values in kept_rows:
        L = leaves_by_id.get(rid)
        if L is None:
            refreshed_rows.append((rid, values))
            continue
        fresh = await build_row(L, personnel_map, user_map, holidays)
        fresh.append(rid)
        old_vis = [str(v) if v is not None else "" for v in values[:len(COLUMNS)]]
        new_vis = [str(v) if v is not None else "" for v in fresh[:len(COLUMNS)]]
        if old_vis[:6] != new_vis[:6]:
            try:
                same_days = float(old_vis[5] or 0) == float(new_vis[5] or 0)
            except ValueError:
                same_days = False
            if old_vis[:5] != new_vis[:5] or not same_days:
                updated_count += 1
                print(f"GUNCELLENDI: {new_vis[0]} {new_vis[1]} | {old_vis[2]}-{old_vis[3]} -> {new_vis[2]}-{new_vis[3]}")
        refreshed_rows.append((rid, fresh))
    kept_rows = refreshed_rows

    # Dosyada henuz olmayan (yeni) izinleri bul
    new_for_master = [L for L in all_leaves if str(L.get("id", "")) not in kept_ids]
    new_rows = []
    for L in new_for_master:
        row = await build_row(L, personnel_map, user_map, holidays)
        row.append(L.get("id", ""))  # gizli Kayit ID
        new_rows.append(row)

    # Veri satirlarini temizleyip yeni (en ustte) + korunan (eski sirasiyla) yaz
    if ws.max_row > 1:
        ws.delete_rows(2, ws.max_row - 1)
    all_rows_to_write = new_rows + [values for _, values in kept_rows]
    for r_idx, row in enumerate(all_rows_to_write, start=2):
        for c_idx, val in enumerate(row, start=1):
            ws.cell(row=r_idx, column=c_idx, value=val)

    if new_rows:
        print(f"OK: Guncel Yillik Izin -> {len(new_rows)} yeni kayit basa eklendi.")
    if removed_count:
        print(f"OK: Guncel Yillik Izin -> {removed_count} silinmis kayit temizlendi.")
    if updated_count:
        print(f"OK: Guncel Yillik Izin -> {updated_count} kaydin tarihi/gunu guncellendi.")
    if not new_rows and not removed_count and not updated_count:
        print("OK: Guncel Yillik Izin -> degisiklik yok, dosya zaten guncel.")

    # "Personel" sayfasi: Sicil No | Ad Soyad | Departman | Gorev
    # (Personel Canli Takip > Devam Takvimi giris-cikis raporu icin; her calismada yeniden yazilir.)
    if "Personel" in wb.sheetnames:
        del wb["Personel"]
    pws = wb.create_sheet("Personel")
    pws.append(["Sicil No", "Ad Soyad", "Departman", "Gorev"])
    for i, w in enumerate((12, 30, 30, 30), start=1):
        pws.cell(row=1, column=i).font = Font(bold=True)
        pws.column_dimensions[pws.cell(row=1, column=i).column_letter].width = w
    pcount = 0
    async for p in db.personnel.find({}, {"_id": 0, "sicil_no": 1, "ad_soyad": 1, "departman": 1, "gorev": 1}):
        pws.append([str(p.get("sicil_no") or ""), p.get("ad_soyad") or "",
                    p.get("departman") or "", p.get("gorev") or ""])
        pcount += 1
    wb.active = wb.sheetnames.index(ws.title)
    print(f"OK: Personel sayfasi -> {pcount} personel (departman/gorev) yazildi.")

    os.makedirs(os.path.dirname(MASTER_PATH), exist_ok=True)
    wb.save(MASTER_PATH)

    # ---------------------------------------------------------------
    # 2) GUNLUK DOSYA — sadece BUGUN (Turkiye yerel gunu) olusturulmus
    #    kayitlar, ayri dosya
    # ---------------------------------------------------------------
    today_str = datetime.now(TR_TZ).strftime("%Y-%m-%d")
    today_leaves = [L for L in all_leaves if to_tr_date_str(str(L.get("created_at", ""))) == today_str]

    if today_leaves:
        os.makedirs(DAILY_DIR, exist_ok=True)
        daily_path = os.path.join(DAILY_DIR, f"Gunluk_Izin_{today_str}.xlsx")
        dwb = Workbook()
        dws = dwb.active
        dws.title = SHEET_NAME
        style_header(dws, with_id_col=False)
        for r_idx, L in enumerate(today_leaves, start=2):
            row = await build_row(L, personnel_map, user_map, holidays)
            for c_idx, val in enumerate(row, start=1):
                dws.cell(row=r_idx, column=c_idx, value=val)
        dwb.save(daily_path)
        print(f"OK: Gunluk dosya -> {len(today_leaves)} kayit yazildi -> {daily_path}")
        # Mail eki artik gunluk dosya degil, guncellenmis Guncel Yillik Izin
        # dosyasi (tum kayitlar) — sadece bugun yeni izin girildiyse gonderilir.
        send_daily_report_email(MASTER_PATH, len(today_leaves), today_str)
    else:
        print("OK: Gunluk dosya -> bugun olusturulmus kayit yok, dosya olusturulmadi.")


if __name__ == "__main__":
    asyncio.run(main())
