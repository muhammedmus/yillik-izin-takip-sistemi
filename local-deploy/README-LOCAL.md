# Merkoteks Personel & İzin Sistemi — LOCAL / ON-PREMISE Kurulum

Windows sunucu (ana bilgisayar) üzerinde çalışır, LAN'daki tüm bilgisayarlar
tarayıcıdan `http://SERVER_IP` adresine bağlanır. İnternet bağlantısı
zorunlu değildir (sadece ilk kurulum için Docker image indirmesi gerekir).

---

## 1. Windows Gereksinimleri

- Windows 10 / 11 (64-bit)
- **Docker Desktop for Windows** (v4.26+)  
  <https://www.docker.com/products/docker-desktop/>  
  Kurulumdan sonra Docker Desktop'ı en az bir kez açın ve WSL2 bileşenini bekleyin.
- En az 8 GB RAM, 10 GB boş disk
- **STATIK LAN IP** önerilir (aşağıda anlatılır)
- Windows Firewall port 80 (HTTP) izinli olmalı

---

## 2. Docker Kurulumu

1. Yukarıdaki linkten Docker Desktop yükleyin ve bilgisayarı yeniden başlatın.  
2. Docker Desktop **Settings → Resources → Advanced**:  
   - CPU: ≥ 2, Memory: ≥ 4 GB
3. **Settings → General**: "Start Docker Desktop when you log in" işaretli olsun.
4. Terminal'de doğrulayın:
   ```
   docker --version
   docker compose version
   ```

---

## 3. Klasör Kurulumu

Örnek plan (D: sürücüsü):

```
D:\PersonelIzin\
├── local-deploy\               ← bu repo'daki local-deploy içeriği
└── data\                       ← kalıcı veriler (otomatik oluşur)
    ├── mongodb\
    ├── uploads\
    └── backup\
```

1. Bu repo'yu (veya sadece `local-deploy/` klasörünü) `D:\PersonelIzin\` altına kopyalayın.  
2. **Aynı seviyede** `backend/` ve `frontend/` klasörleri de olmalı — Dockerfile'lar
   bunlara referans veriyor.

---

## 4. `.env` Oluşturma

```
cd D:\PersonelIzin\local-deploy
copy .env.example .env
notepad .env
```

Aşağıdaki 3 değeri **mutlaka değiştirin**:

| Alan | Ne yazın? |
|---|---|
| `DATA_DIR` | `D:/PersonelIzin/data` (Windows'ta / kullanın) |
| `ADMIN_PASSWORD` | Güçlü şifre (en az 12 karakter, harf+rakam+sembol) |
| `JWT_SECRET` | 64+ karakter random. Üretim komutu: PowerShell'de<br>`[Convert]::ToBase64String((1..64 | %{Get-Random -Max 256}))` |

Diğer alanlar varsayılan bırakılabilir.

---

## 5. Production Yedeğini Local'e Aktarma (opsiyonel)

Eğer production'daki 292 personel + 4204 izin verisini local'e taşımak istiyorsanız:

1. Production'dan aldığınız iki dosyayı (`mrk_dump_YYYYMMDD.tar.gz` +
   `mrk_blobs_YYYYMMDD.tar.gz`) `C:\indirilenler\` gibi bir yere koyun.
2. Önce sistemi başlatın (adım 6).
3. Sonra ithalat:
   ```
   cd D:\PersonelIzin\local-deploy\scripts
   migrate-from-prod.bat  C:\indirilenler\mrk_dump_20260813.tar.gz  C:\indirilenler\mrk_blobs_20260813.tar.gz
   ```

Personel UUID'leri, izin ID'leri, kullanıcı şifre hash'leri **birebir korunur**.
Production ortamına **DOKUNULMAZ**.

---

## 6. Sistemi Başlatma

```
cd D:\PersonelIzin\local-deploy\scripts
start.bat
```

İlk çalıştırma 5–10 dakika sürer (Docker image build). Sonrakiler ~10 saniye.

**Otomatik çalışan servisler:**
- `merkoteks-mongodb` — veritabanı
- `merkoteks-backend` — FastAPI + LibreOffice PDF
- `merkoteks-nginx` — reverse proxy (port 80)

---

## 7. Windows Firewall

Docker Desktop kurulduğunda Windows Firewall otomatik izin ister. Eğer LAN'dan
başka bir bilgisayardan `http://SERVER_IP` açılmıyorsa:

1. `WF.msc` çalıştırın → **Gelen Kurallar** → **Yeni Kural**
2. Kural Türü: **Bağlantı Noktası** → TCP → **80** → İzin ver → Tüm profiller
3. Ad: "Merkoteks HTTP"

---

## 8. Static LAN IP Ayarlama

Client'lar her seferinde aynı adresi kullanabilsin diye sunucu bilgisayara
sabit IP verin:

1. **Denetim Masası → Ağ ve Paylaşım Merkezi → Adaptör Ayarları**
2. Wi-Fi/Ethernet → **Özellikler → IPv4**:
   - IP: `192.168.1.50` (örnek — kendi ağınıza göre)
   - Alt ağ: `255.255.255.0`
   - Ağ geçidi: `192.168.1.1`
   - DNS: `192.168.1.1` + `8.8.8.8`

---

## 9. Client Bilgisayardan Erişim

Sunucu IP'yi öğrenin:
```
ipconfig | findstr IPv4
```

Client'ta tarayıcıyı açın:
```
http://192.168.1.50
```

Login ekranı: `.env` içindeki `ADMIN_EMAIL` + `ADMIN_PASSWORD`.

---

## 10. Backup (Yedekleme)

```
cd D:\PersonelIzin\local-deploy\scripts
backup.bat
```

Sonuç: `D:\PersonelIzin\data\backup\YYYY-MM-DD_HHMM\` içinde:
- `mongodb\merkoteks_hr.archive.gz` (MongoDB dump)
- `uploads\` (yüklenmiş tüm belgeler)
- `manifest.txt` (SHA-256 dahil)

**Otomatik günlük yedek**: `backup.bat`'i Windows Task Scheduler'a ekleyip
her gece 02:00'da çalıştırın.

---

## 11. Restore (Geri Yükleme)

```
cd D:\PersonelIzin\local-deploy\scripts
restore.bat "D:\PersonelIzin\data\backup\2026-08-13_0230"
```

**Sadece LOCAL** MongoDB'yi etkiler. Production'a dokunulmaz.

---

## 12. Update (Uygulama Güncelleme)

Yeni sürüm çıktığında:

```
cd D:\PersonelIzin\local-deploy
git pull                        # veya yeni kod'u kopyalayın
docker compose build backend nginx
docker compose up -d
```

Veriler kaybolmaz (bind mount'ta korunur).

---

## 13. Troubleshooting

| Sorun | Çözüm |
|---|---|
| `docker compose` bulunmuyor | Docker Desktop'ı yükleyip PC'yi restart edin |
| Container `unhealthy` | `scripts\health-check.bat` çalıştırın; log: `docker logs merkoteks-<servis>` |
| Client açamıyor | Windows Firewall port 80 izni + client IP subnet aynı mı |
| Yavaş PDF | Backend container'a RAM artırın (`Settings → Resources`) |
| Şifre unutuldu | `.env` içinde `ADMIN_PASSWORD` değiştirip `docker compose restart backend` |
| MongoDB alanı büyüdü | `data\mongodb` boyutunu izleyin; yedek alıp `docker compose down -v && docker compose up -d` |
| PDF üretilemiyor | `health-check.bat` → LibreOffice satırı ✅ mi kontrol edin |

---

## 14. Güvenlik Notları

- **MongoDB port 27017 LAN'a AÇIK DEĞİL** (yalnız Docker internal network).
- **Backend port 8001 LAN'a AÇIK DEĞİL** (yalnız Nginx üzerinden).
- **HTTPS önerilir**: LAN içi için gerekmese de, kritik veri için
  self-signed certificate + nginx SSL config eklenebilir (gelişmiş).
- Kritik verilerin haftalık yedeğini USB/harici diske kopyalayın.

---

## 15. Servis Listesi & Portlar

| Servis | Container adı | Iç port | Dış (LAN) port | Açıklama |
|---|---|---|---|---|
| MongoDB | `merkoteks-mongodb` | 27017 | **YOK** | Sadece internal |
| Backend | `merkoteks-backend` | 8001 | **YOK** | Sadece internal |
| Nginx | `merkoteks-nginx` | 80 | **80** | LAN girişi |

Local URL: **http://SERVER_IP/**  
API endpoint: **http://SERVER_IP/api/…**
