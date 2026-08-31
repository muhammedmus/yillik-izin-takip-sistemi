# Personel İzin Takip Sistemi — Yerel (LAN) Kurulum Rehberi

Bu rehber, sistemi bir Windows bilgisayarda (sunucu olarak) kurup, aynı ağdaki
diğer bilgisayarların tarayıcıdan `http://SUNUCU_IP` adresine bağlanmasını
sağlar. İnternet bağlantısı sadece **ilk kurulumda** (Docker Desktop indirme,
Docker image'larını çekme) gereklidir; kurulumdan sonra internet olmadan da
çalışır.

**Bu rehberi izlerken:**
- `>` ile başlayan gri kutulardaki komutları **olduğu gibi** kopyalayıp
  PowerShell'e yapıştırın.
- Köşeli parantez `[...]` içindeki yerleri kendi bilginizle değiştirin.
- Bir adımda hata alırsanız paniklemeyin — **13. Sorun Giderme** bölümünde
  en sık karşılaşılan hatalar ve çözümleri var.

---

## İçindekiler

1. [Gereksinimler](#1-gereksinimler)
2. [Docker Desktop Kurulumu](#2-docker-desktop-kurulumu)
3. [Sık Karşılaşılan Kurulum Engeli: Nested Virtualization](#3-sık-karşılaşılan-kurulum-engeli-nested-virtualization)
4. [Git Kurulumu](#4-git-kurulumu)
5. [Projeyi İndirme (Klonlama)](#5-projeyi-i̇ndirme-klonlama)
6. [.env Dosyasını Oluşturma](#6-env-dosyasını-oluşturma)
7. [Sistemi Başlatma](#7-sistemi-başlatma)
8. [İlk Girişi Yapma](#8-i̇lk-girişi-yapma)
9. [Windows Firewall Ayarı (LAN Erişimi İçin)](#9-windows-firewall-ayarı-lan-erişimi-i̇çin)
10. [Static (Sabit) LAN IP Ayarlama](#10-static-sabit-lan-ip-ayarlama)
11. [Yedekleme ve Geri Yükleme](#11-yedekleme-ve-geri-yükleme)
12. [Başka Bir Bilgisayardan Veri Taşıma (Migration)](#12-başka-bir-bilgisayardan-veri-taşıma-migration)
13. [Sorun Giderme](#13-sorun-giderme)
14. [Güvenlik Notları](#14-güvenlik-notları)
15. [Servis Listesi ve Portlar](#15-servis-listesi-ve-portlar)

---

## 1. Gereksinimler

- Windows 10 / 11 (64-bit)
- En az 8 GB RAM, 10 GB boş disk alanı
- Yönetici (Administrator) yetkisine sahip bir Windows kullanıcı hesabı
- İlk kurulum için internet bağlantısı

---

## 2. Docker Desktop Kurulumu

1. <https://www.docker.com/products/docker-desktop/> adresinden Docker
   Desktop'ı indirin ve kurun.
2. Kurulum bitince bilgisayarı **yeniden başlatın**.
3. Docker Desktop'ı açın ve motorun ("Engine running") tamamen başlamasını
   bekleyin (sistem tepsisindeki balina ikonu sabitleşir).
4. Doğrulamak için PowerShell'de:
   ```
   docker --version
   docker compose version
   ```
   İkisi de bir versiyon numarası döndürmeli.

**Eğer Docker Desktop açılırken "Virtualization support not detected" hatası
alırsanız**, bir sonraki bölüme geçin — bu çok yaygın bir durumdur ve
kolayca çözülür.

---

## 3. Sık Karşılaşılan Kurulum Engeli: Nested Virtualization

### Bu sorunu nasıl anlarım?

Docker Desktop açılışta "Virtualization support not detected" hatası
veriyorsa, önce şunu kontrol edin:

1. **Görev Yöneticisi → Performans → CPU** sekmesine gidin.
2. Sağ alt köşede **"Sanal Makine: Evet"** yazıyorsa, kullandığınız bilgisayar
   aslında fiziksel değil, bir **sanal makine (VM)**'dir.

Bu durumda sorun kendi bilgisayarınızın BIOS ayarında değil — VM'i barındıran
sunucudaki (hypervisor) bir ayardadır ve bunu sizin kendi başınıza
düzeltmeniz mümkün değildir.

### Çözüm

VM'i barındıran hypervisor'a erişimi olan IT/sistem yöneticinize şu isteği
iletin:

> "[Bilgisayar adı/IP] adlı sanal makinemde Docker Desktop çalıştırmam
> gerekiyor ama 'nested virtualization' kapalı olduğu için sanallaştırma
> desteği görünmüyor. Hypervisor üzerinden bu VM için nested virtualization /
> hardware-assisted virtualization desteğinin açılmasını rica ediyorum."

IT ekibi hangi hypervisor'ı kullandığına göre şu ayarı yapacaktır:

| Hypervisor | Yapılacak ayar |
|---|---|
| **Hyper-V** | VM kapalıyken PowerShell (admin): `Set-VMProcessor -VMName "VM_ADI" -ExposeVirtualizationExtensions $true` |
| **VMware** (ESXi/Workstation/vSphere) | VM Settings → CPU → **"Expose hardware assisted virtualization to the guest OS"** işaretlenir |
| **Proxmox** (KVM/QEMU) | VM → Hardware → CPU Type: `host` olarak ayarlanır |

Bu ayar yapıldıktan ve VM yeniden başlatıldıktan sonra Docker Desktop'ı
tekrar açıp deneyin.

---

## 4. Git Kurulumu

Projeyi GitHub'dan indirmek için Git gerekir.

1. Önce kurulu olup olmadığını kontrol edin:
   ```
   git --version
   ```
   Bir versiyon numarası dönerse (örn. `git version 2.55.0`), bu adımı
   atlayıp **5. Adım**'a geçebilirsiniz.

2. Kurulu değilse <https://git-scm.com/download/win> adresinden indirin ve
   çalıştırın.

3. Kurulum sihirbazındaki **tüm ekranlarda varsayılan ayarları
   değiştirmeden "Next" ile ilerleyin** — özellikle "Adjusting your PATH
   environment" ekranında **"Git from the command line and also from
   3rd-party software"** seçeneği zaten işaretlidir, bu, `git` komutunun
   PowerShell'de çalışması için gereklidir.

4. Kurulum bitince **PowerShell penceresini tamamen kapatıp yeniden açın**
   (bu adım kritik — aynı pencerede devam ederseniz `git` komutu hâlâ
   tanınmayabilir, çünkü PATH güncellemesi sadece yeni açılan pencerelerde
   etkili olur).

5. Doğrulayın:
   ```
   git --version
   ```

---

## 5. Projeyi İndirme (Klonlama)

1. Projenin duracağı bir klasör oluşturup içine girin (örnek olarak
   `C:\Projeler` kullanıyoruz, isterseniz farklı bir yol seçebilirsiniz —
   ama seçtiğiniz yolu sonraki adımlarda tutarlı kullanmalısınız):
   ```
   mkdir C:\Projeler
   cd C:\Projeler
   ```

2. Repo'yu klonlayın:
   ```
   git clone https://github.com/muhammedmus/yillik-izin-takip-sistemi.git
   ```

3. Klasöre girip `local-deploy` alt klasörünün var olduğunu doğrulayın:
   ```
   cd yillik-izin-takip-sistemi
   dir local-deploy
   ```
   `docker-compose.yml`, `.env.example`, `scripts` gibi dosya/klasörleri
   görmelisiniz.

---

## 6. `.env` Dosyasını Oluşturma

`.env` dosyası, sistemin şifreleri ve bağlantı bilgilerini tuttuğu dosyadır.
Bu dosya GitHub'a **yüklenmez** (güvenlik nedeniyle), bu yüzden her kurulumda
elle oluşturulması gerekir.

### 6.1. Örnek dosyayı kopyalayın

```
cd local-deploy
copy .env.example .env
```

### 6.2. JWT_SECRET için rastgele bir değer üretin

```
[Convert]::ToBase64String((1..64 | %{Get-Random -Max 256}))
```

Çıkan uzun metni bir kenara not edin (kopyalayın) — birazdan `.env`
dosyasına yapıştıracaksınız.

### 6.3. `.env` dosyasını düzenleyin

> **ÖNEMLİ — Türkçe karakter uyarısı:** `.env` dosyasını Not Defteri ile
> elle düzenlerken hiçbir sorun olmaz. Ancak eğer bu rehberdeki gibi
> PowerShell komutlarıyla (`Get-Content` / `Set-Content`) otomatik
> düzenleme yaparsanız, Türkçe karakterler (ı, ş, ğ, ü, ö, ç, İ) bozulabilir.
> Bu yüzden `.env` dosyasını **Not Defteri ile elle düzenlemeniz** önerilir.

```
notepad .env
```

Açılan dosyada şu 3 alanı **mutlaka** değiştirin:

| Alan | Ne yazılmalı? | Örnek |
|---|---|---|
| `DATA_DIR` | Projeyi kopyaladığınız klasörün altında bir `data` klasörü, düz slash (`/`) ile | `C:/Projeler/yillik-izin-takip-sistemi/data` |
| `ADMIN_EMAIL` | Geçerli bir e-posta formatında olmalı. **`.local` gibi uzantılar tarayıcılar tarafından geçersiz sayılabilir**, gerçek bir e-posta adresi kullanın | `admin@sirketiniz.com` |
| `ADMIN_PASSWORD` | Güçlü bir şifre (en az 12 karakter, harf+rakam+sembol karışık) | `Guvenli2026!Sifre` |
| `JWT_SECRET` | 6.2. adımda ürettiğiniz uzun rastgele değer | (üretilen değer) |

Diğer alanlar (`DB_NAME`, `EMAIL_FROM_NAME` vb.) varsayılan bırakılabilir.

Kaydedip (Ctrl+S) Not Defteri'ni kapatın.

---

## 7. Sistemi Başlatma

```
cd scripts
.\start.bat
```

**İlk çalıştırma 5–10 dakika sürer** (Docker image'ları sıfırdan indirilip
derlenir). Ekranda çok satır teknik metin akacaktır — bu normaldir,
kapatmayın. İşlem bitince ekranda şu bilgiler görünür:

- Container durumları (`merkoteks-mongodb`, `merkoteks-backend`,
  `merkoteks-nginx` — hepsi "Healthy"/"Running"/"Started" olmalı)
- Bu bilgisayarın LAN IP adresi
- Client bilgisayarların bağlanacağı adres (`http://SUNUCU_IP`)

Sonraki başlatmalar (`.\start.bat` tekrar çalıştırıldığında) çok daha hızlıdır
(~10 saniye).

---

## 8. İlk Girişi Yapma

1. Bu bilgisayarda bir tarayıcı açıp şu adrese gidin:
   ```
   http://localhost
   ```
2. `.env` dosyasında belirlediğiniz `ADMIN_EMAIL` ve `ADMIN_PASSWORD` ile
   giriş yapın.

**Giriş "şifre hatalı" diyorsa:** Muhtemelen `.env` dosyasındaki bilgiler
ile tarayıcıya girdiğiniz bilgiler eşleşmiyor, veya tarayıcının otomatik
doldurma özelliği eski bir şifre öneriyor olabilir. Gizli/InPrivate pencerede
(Ctrl+Shift+N) tekrar deneyin. Sorun devam ederse **13. Sorun Giderme**
bölümüne bakın.

---

## 9. Windows Firewall Ayarı (LAN Erişimi İçin)

Docker Desktop kurulduğunda Windows Firewall genelde otomatik izin ister.
Eğer LAN'daki başka bir bilgisayardan `http://SUNUCU_IP` açılmıyorsa:

1. Başlat menüsünde `wf.msc` yazıp çalıştırın (Gelişmiş Güvenlikli Windows
   Defender Güvenlik Duvarı açılır).
2. **Gelen Kurallar** → **Yeni Kural**.
3. Kural Türü: **Bağlantı Noktası** → İleri.
4. **TCP** → **Belirli yerel bağlantı noktaları**: `80` → İleri.
5. **Bağlantıya izin ver** → İleri.
6. Tüm profiller (Domain, Özel, Genel) işaretli kalsın → İleri.
7. Ad: `Personel Izin Takip HTTP` → Son.

---

## 10. Static (Sabit) LAN IP Ayarlama

Sunucu bilgisayarın IP adresi değişirse, client bilgisayarlar sisteme
erişemez hale gelir. Bunu önlemek için sunucuya sabit IP verin:

1. **Denetim Masası → Ağ ve Paylaşım Merkezi → Bağdaştırıcı Ayarlarını
   Değiştir**.
2. Kullandığınız bağlantıya (Ethernet/Wi-Fi) sağ tıklayıp **Özellikler**.
3. **IPv4** seçip **Özellikler**:
   - IP adresi: (örn. `192.168.1.50` — ağınıza uygun, kullanılmayan bir IP)
   - Alt ağ maskesi: `255.255.255.0`
   - Ağ geçidi: (örn. `192.168.1.1`)
   - DNS: `192.168.1.1` ve `8.8.8.8`

---

## 11. Yedekleme ve Geri Yükleme

### Yedek alma

```
cd local-deploy\scripts
.\backup.bat
```

Sonuç, `[DATA_DIR]\backup\TARIH_SAAT\` klasöründe oluşur:
- `mongodb\merkoteks_hr.archive.gz` — tüm veritabanı
- `uploads\` — yüklenen belgeler
- `manifest.txt` — SHA-256 doğrulama bilgisi

> **Not:** Eğer yedek alırken "MongoDB connection string" hatası veya
> "uploads bulunamadı" hatası alırsanız, `.env` dosyasının doğru
> `DATA_DIR` ve bağlantı bilgileriyle dolu olduğunu kontrol edin (bkz.
> **13. Sorun Giderme**).

**Otomatik günlük yedek:** `backup.bat`'i Windows Görev Zamanlayıcı'ya
ekleyip her gece (örn. 02:00) otomatik çalıştırabilirsiniz.

### Geri yükleme

```
cd local-deploy\scripts
.\restore.bat "[DATA_DIR]\backup\TARIH_SAAT"
```

**Dikkat:** Bu işlem, mevcut veritabanının üzerine yazar. Sadece **local**
MongoDB'yi etkiler.

---

## 12. Başka Bir Bilgisayardan Veri Taşıma (Migration)

Eğer sistemi başka bir bilgisayardan bu bilgisayara taşıyorsanız (örn. eski
sunucudan yeni sunucuya geçiş):

### 12.1. Eski bilgisayarda yedek alın

Eski bilgisayarın başına oturup (veya uzak masaüstüyle bağlanıp), o
bilgisayardaki `local-deploy\scripts` klasöründe:

```
.\backup.bat
```

> **Önemli:** `.env` dosyasının eski bilgisayarda var olduğunu ve doğru
> dolu olduğunu kontrol edin. Eğer `.env` dosyası eksikse veya içindeki
> `DATA_DIR` bu bilgisayarda var olmayan bir sürücüyü (örn. `D:` sürücüsü
> yokken `D:/...` yazıyorsa) gösteriyorsa, yedek alma işlemi hata verir.
> Gerçek bağlantı bilgilerini şu komutla container'dan doğrudan
> öğrenebilirsiniz:
> ```
> docker inspect merkoteks-backend --format "{{range .Config.Env}}{{println .}}{{end}}"
> ```

### 12.2. Yedeği yeni bilgisayara taşıyın

**Ağ paylaşımı ile (iki bilgisayar aynı LAN'daysa):**

1. Eski bilgisayarda yedek klasörüne sağ tıklayıp **Ver → Belirli
   kişiler...** ile paylaşıma açın (Everyone + Read yetkisi yeterli).
2. Paylaşım sonrası çıkan ağ yolunu not edin (örn.
   `\\ESKI-BILGISAYAR-ADI\TARIH_SAAT`).
3. Yeni bilgisayarda:
   ```
   mkdir C:\Projeler\yillik-izin-takip-sistemi\local-deploy\data\backup\gelen-yedek -Force
   Copy-Item -Path "\\ESKI-BILGISAYAR-ADI\TARIH_SAAT\*" -Destination "C:\Projeler\yillik-izin-takip-sistemi\local-deploy\data\backup\gelen-yedek" -Recurse
   ```

**USB bellek ile:** Yedek klasörünü USB belleğe kopyalayıp yeni bilgisayarda
aynı konuma (`local-deploy\data\backup\gelen-yedek`) yapıştırabilirsiniz.

### 12.3. Yeni bilgisayarda geri yükleyin

```
cd local-deploy\scripts
.\restore.bat "C:\Projeler\yillik-izin-takip-sistemi\local-deploy\data\backup\gelen-yedek"
```

İşlem bitince ekranda "X document(s) restored successfully" yazısını
görmelisiniz. Ardından `http://localhost` adresinden giriş yapıp verilerin
(personel listesi, izin kayıtları) doğru geldiğini kontrol edin.

---

## 13. Sorun Giderme

| Sorun | Olası Neden | Çözüm |
|---|---|---|
| `docker compose` bulunmuyor | Docker Desktop kurulu değil veya PATH güncellenmemiş | Docker Desktop'ı kurup PC'yi yeniden başlatın |
| Docker Desktop "Virtualization support not detected" | Bilgisayar bir sanal makine ve nested virtualization kapalı | Bkz. **3. Bölüm** |
| `git` komutu tanınmıyor | Git kurulumdan sonra PowerShell yeniden açılmadı | PowerShell penceresini kapatıp yeniden açın |
| Giriş ekranında "şifre hatalı" | `.env`'deki bilgiler ile girilen bilgiler uyuşmuyor, veya tarayıcı eski bilgi öneriyor | Gizli pencerede deneyin; `docker logs merkoteks-backend --tail 30` ile gerçek admin e-postasını kontrol edin |
| E-posta kutusu "geçersiz e-posta" diyor | `.env`'de `.local` gibi tarayıcının reddettiği bir uzantı kullanılmış | `ADMIN_EMAIL`'i gerçek bir domain ile (örn. `.com`) değiştirip sistemi sıfırlayın (`docker compose down -v` + `start.bat`) |
| Değişiklik yaptım ama tarayıcıda görünmüyor | Docker build önbelleği (cache) eski dosyayı kullanıyor | `docker compose build --no-cache nginx` ile sıfırdan derleyip `docker compose up -d --force-recreate nginx` ile yeniden başlatın |
| Türkçe karakterler bozuk görünüyor (İ, ı, ş yerine tuhaf semboller) | Dosya, PowerShell'in eski metin okuma komutlarıyla (`Get-Content`/`Set-Content`) yanlış kodlamayla kaydedilmiş | Dosyayı Not Defteri ile elle düzenleyin, veya `.NET` dosya yazma fonksiyonlarını UTF-8 belirterek kullanın |
| `backup.bat` "MongoDB connection string" hatası veriyor | `.env` dosyası eksik veya `DATA_DIR` geçersiz bir sürücü gösteriyor | `.env`'nin var olduğunu ve `DATA_DIR`'in bu bilgisayarda gerçekten var olan bir yolu gösterdiğini kontrol edin |
| Container `unhealthy` durumda | Servis düzgün başlamamış | `scripts\health-check.bat` çalıştırın; detaylı log için `docker logs merkoteks-<servis>` |
| Client bilgisayardan siteye erişilemiyor | Windows Firewall port 80'i engelliyor | Bkz. **9. Bölüm** |
| Şifre unutuldu | — | `.env` içinde `ADMIN_PASSWORD`'ü değiştirip `docker compose restart backend` |
| PDF üretilemiyor | LibreOffice bileşeni sorunlu | `health-check.bat` çalıştırıp LibreOffice satırının ✅ olduğunu kontrol edin |

---

## 14. Güvenlik Notları

- **MongoDB (port 27017) LAN'a açık değildir** — sadece Docker'ın kendi iç
  ağında erişilebilir.
- **Backend (port 8001) LAN'a açık değildir** — sadece Nginx üzerinden
  erişilir.
- `.env` dosyasını asla GitHub'a veya paylaşılan bir yere yüklemeyin —
  içinde şifreler ve gizli anahtarlar bulunur.
- Kritik verilerin haftalık yedeğini USB/harici diske de kopyalamanız
  önerilir.

---

## 15. Servis Listesi ve Portlar

| Servis | Container adı | İç port | Dış (LAN) port | Açıklama |
|---|---|---|---|---|
| MongoDB | `merkoteks-mongodb` | 27017 | **Yok** | Sadece Docker iç ağı |
| Backend | `merkoteks-backend` | 8001 | **Yok** | Sadece Nginx üzerinden |
| Nginx | `merkoteks-nginx` | 80 | **80** | LAN girişi |

- Local URL: **http://SUNUCU_IP/**
- API endpoint: **http://SUNUCU_IP/api/…**
