# Yıllık İzin Takip Sistemi

Personel ve yıllık izin süreçlerini yerel ağ üzerinde yönetmek için hazırlanmış Docker tabanlı personel ve izin takip uygulamasıdır.

Sistem temel olarak şu bileşenlerden oluşur:

- React frontend
- FastAPI backend
- MongoDB
- Nginx
- Docker Desktop / Docker Compose
- Local dosya saklama
- Otomatik MongoDB, Excel ve CSV yedekleme

---

## 1. Sistem Özellikleri

Başlıca özellikler:

- Personel kayıt ve takip
- Aktif / işten ayrılmış personel yönetimi
- Yıllık izin kayıtları
- İzin hak ediş hesaplamaları
- Kullanılan ve kalan izin hesaplamaları
- İzin cetveli
- İzin talep formu önizleme
- İzin talep formu PDF çıktısı
- Muvafakatname oluşturma
- Muvafakatname takibi
- Özel izin takibi
- Özel izin belge yükleme / indirme
- Toplu izin işlemleri
- Excel ile toplu veri işlemleri
- Raporlama
- Departman bazlı izin raporu
- Tüm personel izin raporu
- Excel rapor çıktısı
- Kullanıcı ve yetki yönetimi
- İşlem geçmişi / audit kayıtları
- Türkçe karakter uyumlu personel araması
- Otomatik günlük yedekleme
- MongoDB yedekten geri yükleme

---

## 2. Stabil Sürüm

İlk stabil local Docker sürümü:

```text
v1.0-stable
```

Bu sürüm etiketi, çalışan ve test edilmiş temel sürümü ifade eder.

Stabil sürüme geçmek için:

```powershell
git checkout v1.0-stable
```

Tekrar güncel ana sürüme dönmek için:

```powershell
git checkout main
git pull
```

---

## 3. Sistem Gereksinimleri

Yeni bir bilgisayara kurulumdan önce aşağıdaki yazılımların kurulması gerekir:

- Windows 10 veya Windows 11
- Git for Windows
- Docker Desktop
- WSL2
- En az 8 GB RAM önerilir
- Yerel ağ bağlantısı

Docker Desktop açıldıktan sonra:

```text
Engine running
```

durumunun görülmesi gerekir.

---

## 4. GitHub'dan İlk Kurulum

PowerShell açın.

Örnek kurulum klasörüne geçin:

```powershell
cd "C:\Users\Public"
```

Projeyi GitHub'dan indirin:

```powershell
git clone https://github.com/muhammedmus/yillik-izin-takip-sistemi.git PersonelIzin
```

Proje klasörüne geçin:

```powershell
cd "C:\Users\Public\PersonelIzin"
```

---

## 5. Local Ortam Dosyasını Hazırlama

Local deployment klasörüne geçin:

```powershell
cd "C:\Users\Public\PersonelIzin\local-deploy"
```

Örnek ortam dosyasını gerçek `.env` dosyası olarak kopyalayın:

```powershell
Copy-Item ".env.example" ".env"
```

Dosyayı açın:

```powershell
notepad ".env"
```

Örnek yapı:

```env
DATA_DIR=C:/Users/Public/PersonelIzin/data

DB_NAME=personel_izin

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=CHANGE_ME
ADMIN_NAME=Yönetici

JWT_SECRET=CHANGE_ME_WITH_RANDOM_64_CHAR_SECRET

EMAIL_FROM_NAME=Yıllık İzin Takip Sistemi

WEBHOOK_CRON_SECRET=CHANGE_ME

CORS_ORIGINS=*

STORAGE_MODE=local
MONGO_URL=mongodb://mongodb:27017
UPLOAD_PATH=/data/uploads
```

> Gerçek şifreler ve secret değerleri yalnızca `.env` dosyasında tutulmalıdır.

> `.env` dosyası hiçbir zaman GitHub'a yüklenmemelidir.

### Önemli

Mevcut kurulumunuz farklı bir veritabanı adı kullanıyorsa `DB_NAME` değerini değiştirmeyin. Yeni bilgisayara mevcut yedek geri yüklenecekse, yedekte kullanılan veritabanı adıyla aynı değer kullanılmalıdır.

---

## 6. JWT Secret Üretme

Windows PowerShell ile güçlü bir JWT Secret üretmek için:

```powershell
[Convert]::ToBase64String((1..64|%{Get-Random -Max 256}))
```

Üretilen değeri:

```text
JWT_SECRET=
```

alanına yazın.

Örnek:

```env
JWT_SECRET=URETILEN_RASTGELE_DEGER
```

Bu değeri GitHub'a yüklemeyin.

---

## 7. Veri Klasörlerini Oluşturma

PowerShell'de:

```powershell
New-Item -ItemType Directory -Force "C:\Users\Public\PersonelIzin\data"
New-Item -ItemType Directory -Force "C:\Users\Public\PersonelIzin\data\backup"
New-Item -ItemType Directory -Force "C:\Users\Public\PersonelIzin\data\uploads"
```

Bu klasörler GitHub kaynak kodundan bağımsızdır.

---

## 8. Docker ile İlk Kurulum

Local deployment klasörüne geçin:

```powershell
cd "C:\Users\Public\PersonelIzin\local-deploy"
```

İlk kurulumda Docker image'larını oluşturun:

```powershell
docker compose build --no-cache
```

Container'ları başlatın:

```powershell
docker compose up -d
```

Durumu kontrol edin:

```powershell
docker compose ps
```

Backend, MongoDB ve Nginx servislerinin çalışıyor olması gerekir.

İdeal durumda servisler:

```text
healthy
```

durumunda görünmelidir.

---

## 9. Sisteme Erişim

Sunucu olarak kullanılan bilgisayardan:

```text
http://localhost
```

veya:

```text
http://127.0.0.1
```

adresleri kullanılabilir.

Yerel ağdaki diğer bilgisayarlardan ise sunucu bilgisayarının IP adresi kullanılır.

Örnek:

```text
http://192.168.10.165
```

Sunucu bilgisayarının IP adresini görmek için:

```powershell
ipconfig
```

çıktısındaki:

```text
IPv4 Address
```

satırını kontrol edin.

IP adresi bilgisayar veya ağ değiştiğinde farklı olabilir.

---

## 10. GitHub ile Veritabanı Yedeğinin Farkı

GitHub **uygulama kaynak kodunu** saklar.

GitHub içerisinde:

- Backend
- Frontend
- Docker yapılandırması
- Nginx yapılandırması
- Scriptler
- Şablonlar
- Testler
- Kurulum rehberi

bulunur.

GitHub içerisinde gerçek personel verileri bulunmaz.

Personel ve izin kayıtları MongoDB yedeğinden geri yüklenir.

---

## 11. MongoDB Yedeğinden Geri Yükleme

Ana yedek dosyası:

```text
mongodb_dump.archive.gz
```

Örnek yedek klasörü:

```text
C:\Users\Public\PersonelIzin\data\backup\YEDEK_KLASORU\
```

Öncelikle yedek dosyasını MongoDB container içerisine kopyalayın:

```powershell
docker cp "C:\Users\Public\PersonelIzin\data\backup\YEDEK_KLASORU\mongodb_dump.archive.gz" personel-mongodb:/tmp/restore.archive.gz
```

### Container adı farklıysa

Önce:

```powershell
docker compose ps
```

çalıştırın ve MongoDB container adını kontrol edin.

Ardından backend servisini geçici olarak durdurun:

```powershell
docker stop PERSONEL_BACKEND_CONTAINER_ADI
```

Yedeği geri yükleyin:

```powershell
docker exec PERSONEL_MONGODB_CONTAINER_ADI mongorestore --gzip --archive=/tmp/restore.archive.gz --drop
```

Backend'i tekrar başlatın:

```powershell
docker start PERSONEL_BACKEND_CONTAINER_ADI
```

Geçici restore dosyasını silin:

```powershell
docker exec PERSONEL_MONGODB_CONTAINER_ADI rm -f /tmp/restore.archive.gz
```

---

## 12. Yedeği Canlı Sisteme Yüklemeden Önce Test Etme

Önemli yedekleri doğrudan canlı veritabanına yüklemek yerine önce test veritabanına geri yüklemek önerilir.

Örnek:

```powershell
docker exec PERSONEL_MONGODB_CONTAINER_ADI mongorestore `
  --gzip `
  --archive=/tmp/restore.archive.gz `
  --nsFrom="personel_izin.*" `
  --nsTo="personel_izin_restore_test.*"
```

Ardından koleksiyonları kontrol edin:

```powershell
docker exec PERSONEL_MONGODB_CONTAINER_ADI mongosh personel_izin_restore_test --quiet --eval "db.getCollectionNames()"
```

Personel kayıt sayısını kontrol etmek için:

```powershell
docker exec PERSONEL_MONGODB_CONTAINER_ADI mongosh personel_izin_restore_test --quiet --eval "db.personnel.countDocuments({})"
```

İzin kayıt sayısını kontrol etmek için:

```powershell
docker exec PERSONEL_MONGODB_CONTAINER_ADI mongosh personel_izin_restore_test --quiet --eval "db.leaves.countDocuments({})"
```

Test tamamlandığında test veritabanı silinebilir:

```powershell
docker exec PERSONEL_MONGODB_CONTAINER_ADI mongosh --quiet --eval "db.getSiblingDB('personel_izin_restore_test').dropDatabase()"
```

---

## 13. Yüklenen Belgeleri Geri Getirme

MongoDB yedeği, sisteme yüklenen PDF / JPG / PNG dosyalarının kendisini her durumda içermez.

Yüklenen belgeler ayrıca:

```text
data\uploads
```

klasöründe tutulur.

Eski bilgisayardan alınan uploads yedeğini yeni bilgisayardaki:

```text
C:\Users\Public\PersonelIzin\data\uploads
```

klasörüne geri kopyalayın.

Buna aşağıdaki dosyalar dahil olabilir:

- Özel izin belgeleri
- PDF dosyaları
- JPG / JPEG dosyaları
- PNG dosyaları
- Kullanıcı tarafından sisteme yüklenen diğer belgeler

---

## 14. Restore Sonrası Kontrol

Öncelikle Docker servislerini kontrol edin:

```powershell
docker compose ps
```

Ardından uygulamada aşağıdakileri doğrulayın:

- Personel kayıtları geliyor mu?
- Aktif personel sayısı doğru mu?
- İzin kayıtları geliyor mu?
- İzin bakiyeleri doğru mu?
- Kullanıcı girişi çalışıyor mu?
- İzin talep formu açılıyor mu?
- PDF önizleme çalışıyor mu?
- Muvafakatname çalışıyor mu?
- Özel izin belgeleri açılıyor mu?
- Raporlar çalışıyor mu?
- Tüm personel raporu çalışıyor mu?
- Excel çıktısı alınabiliyor mu?

---

## 15. Manuel Yedek Alma

Local deployment klasörüne geçin:

```powershell
cd "C:\Users\Public\PersonelIzin\local-deploy"
```

Yedekleme scriptini çalıştırın:

```powershell
.\scripts\backup.bat
```

Başarılı işlem sonunda:

```text
[OK] Tum adimlar basarili.
```

benzeri bir çıktı görülmelidir.

Yedekler genel olarak:

```text
C:\Users\Public\PersonelIzin\data\backup
```

klasöründe tutulur.

---

## 16. Yedek İçeriği

Yedek klasörlerinde yapılandırmaya bağlı olarak aşağıdaki dosyalar bulunabilir:

```text
mongodb_dump.archive.gz
Yillik_Izin_Tum_Kayitlar.xlsx
Yillik_Izin_Tum_Kayitlar.csv
manifest.txt
SHA256.txt
SON_ISLENEN_IZINLER.txt
```

MongoDB dump dosyası gerçek geri yükleme için temel yedektir.

Excel ve CSV dosyaları ayrıca insan tarafından okunabilir kontrol kopyaları olarak kullanılabilir.

---

## 17. Otomatik Yedekleme

Windows Görev Zamanlayıcı kullanılarak `backup.bat` otomatik çalıştırılabilir.

Örnek program:

```text
C:\Windows\System32\cmd.exe
```

Bağımsız değişken:

```text
/c "C:\Users\Public\PersonelIzin\local-deploy\scripts\backup.bat"
```

Başlangıç klasörü:

```text
C:\Users\Public\PersonelIzin\local-deploy
```

Örnek zamanlama:

```text
Her gün 18:30
```

Görev oluşturulduktan sonra Görev Zamanlayıcı üzerinden manuel çalıştırılıp test edilmelidir.

---

## 18. Docker'ın Windows Açılışında Başlaması

Docker Desktop ayarlarında:

```text
Start Docker Desktop when you sign in to your computer
```

seçeneğinin etkin olması önerilir.

Docker Compose servislerinde uygun restart politikası bulunuyorsa Docker açıldıktan sonra uygulama servisleri otomatik olarak tekrar ayağa kalkabilir.

Kontrol:

```powershell
docker compose ps
```

---

## 19. GitHub'a Yeni Güncelleme Gönderme

Ana geliştirme bilgisayarında uygulamada değişiklik yaptıktan sonra proje klasörüne geçin:

```powershell
cd "C:\Users\muhammed muslu\PersonelIzin"
```

Değişiklikleri kontrol edin:

```powershell
git status
```

Dosyaları staging alanına ekleyin:

```powershell
git add .
```

Tekrar kontrol edin:

```powershell
git status
```

Commit oluşturun:

```powershell
git commit -m "Yapılan değişikliğin kısa açıklaması"
```

GitHub'a gönderin:

```powershell
git push
```

---

## 20. Başka Bilgisayarda Son Güncellemeleri Alma

Mevcut kurulumda proje klasörüne geçin:

```powershell
cd "C:\Users\Public\PersonelIzin"
```

Önce yerel değişiklik olup olmadığını kontrol edin:

```powershell
git status
```

Ardından GitHub'daki son sürümü alın:

```powershell
git pull
```

Docker servislerini yeniden oluşturmak için:

```powershell
cd local-deploy
docker compose build
docker compose up -d
docker compose ps
```

---

## 21. Önemli Güncelleme Öncesi Yedek

Uygulamayı güncellemeden önce veritabanının manuel yedeğini almak önerilir:

```powershell
cd "C:\Users\Public\PersonelIzin\local-deploy"
.\scripts\backup.bat
```

Yedeğin başarılı olduğunu doğruladıktan sonra:

```powershell
cd ..
git pull
```

ve gerekli Docker build işlemlerini gerçekleştirin.

---

## 22. Stabil Sürüme Geri Dönme

Mevcut çalışan stabil sürüm:

```text
v1.0-stable
```

Mevcut yerel değişiklikler commit edilmiş veya yedeklenmiş olmalıdır.

Stabil sürüme dönmek için:

```powershell
git checkout v1.0-stable
```

Ardından:

```powershell
cd local-deploy
docker compose build --no-cache
docker compose up -d
docker compose ps
```

### Tekrar güncel sürüme dönmek

```powershell
cd ..
git checkout main
git pull
```

Ardından gerekiyorsa:

```powershell
cd local-deploy
docker compose build
docker compose up -d
```

---

## 23. Yeni Stabil Sürüm Oluşturma

Önemli bir geliştirme tamamlandıktan ve sistem test edildikten sonra yeni tag oluşturulabilir.

Örnek:

```powershell
git tag -a v1.1-stable -m "Yıllık İzin Takip Sistemi - v1.1 stabil sürüm"
```

GitHub'a gönderin:

```powershell
git push origin v1.1-stable
```

Tag'leri görmek için:

```powershell
git tag -n
```

---

## 24. GitHub ve Yedek Yapısı

### GitHub

GitHub şu bileşenleri korur:

```text
Kaynak kod
Frontend
Backend
Docker yapılandırması
Nginx yapılandırması
Scriptler
Şablonlar
Testler
README
```

### MongoDB yedeği

MongoDB yedeği aşağıdaki verileri korur:

```text
Personel kayıtları
İzin kayıtları
Kullanıcı kayıtları
İzin hak ediş kayıtları
Sistem ayarları
İşlem geçmişleri
```

### Uploads yedeği

Uploads klasörü aşağıdaki dosyaları korur:

```text
PDF
JPG
JPEG
PNG
Özel izin belgeleri
Diğer yüklenen belgeler
```

Bu üç yapı birbirinden ayrı tutulmalıdır.

---

## 25. Güvenlik

GitHub'a kesinlikle yüklenmemesi gereken içerikler:

```text
.env
Gerçek admin şifreleri
JWT secret
API anahtarları
Production secret değerleri
MongoDB canlı verileri
Personel verileri
TC kimlik numaraları
Yedek dosyaları
Yüklenen personel belgeleri
```

Bu dosya ve klasörlerin `.gitignore` tarafından hariç tutulduğundan emin olun.

GitHub repository'sinin `Private` tutulması önerilir.

---

## 26. Git Durum Kontrolü

GitHub'a dosya göndermeden önce:

```powershell
git status
```

çalıştırın.

Aşağıdakilerin yanlışlıkla staged olmadığını kontrol edin:

```text
.env
data/
backup/
uploads/
node_modules/
MongoDB veri klasörleri
```

---

## 27. Sistem Sağlık Kontrolü

Docker servislerinin durumu:

```powershell
docker compose ps
```

Backend logları:

```powershell
docker logs PERSONEL_BACKEND_CONTAINER_ADI --tail 100
```

MongoDB logları:

```powershell
docker logs PERSONEL_MONGODB_CONTAINER_ADI --tail 100
```

Nginx logları:

```powershell
docker logs PERSONEL_NGINX_CONTAINER_ADI --tail 100
```

Backend health endpoint:

```text
/api/health
```

Başarılı durumda HTTP `200` yanıtı alınmalıdır.

---

## 28. Docker Servislerini Yeniden Başlatma

Tüm sistemi yeniden başlatmak için:

```powershell
docker compose restart
```

Sadece backend:

```powershell
docker restart PERSONEL_BACKEND_CONTAINER_ADI
```

Sadece nginx:

```powershell
docker restart PERSONEL_NGINX_CONTAINER_ADI
```

---

## 29. Program Dosya Yapısı

Genel proje yapısı:

```text
PersonelIzin
│
├── backend
│   ├── server.py
│   ├── templates
│   └── tests
│
├── frontend
│   ├── src
│   ├── public
│   └── package.json
│
├── local-deploy
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── backend
│   ├── frontend
│   ├── nginx
│   └── scripts
│
├── tests
├── .github
├── .gitignore
├── env.example
└── README.md
```

---

## 30. Hızlı Yeni Bilgisayar Kurulum Özeti

```text
1. Git for Windows kur
2. Docker Desktop + WSL2 kur
3. GitHub repository'sini clone et
4. local-deploy/.env.example dosyasını .env olarak kopyala
5. Gerçek secret ve admin bilgilerini gir
6. Veri klasörlerini oluştur
7. docker compose build --no-cache çalıştır
8. docker compose up -d çalıştır
9. docker compose ps ile servisleri kontrol et
10. MongoDB yedeğini geri yükle
11. uploads klasörünü geri getir
12. Tarayıcıdan sistemi kontrol et
13. PDF / izin / rapor fonksiyonlarını test et
14. Otomatik günlük yedek görevini oluştur
```

---

## 31. Felaket Kurtarma Özeti

Bilgisayar tamamen arızalansa bile aşağıdaki üç unsur mevcutsa sistem yeniden kurulabilir:

```text
GitHub Repository
        ↓
Uygulama + Backend + Frontend + Docker

MongoDB Yedeği
        ↓
Personel + İzin + Kullanıcı + Sistem Verileri

Uploads Yedeği
        ↓
PDF + JPG + PNG + Yüklenen Belgeler
```

---

## 32. Repository

GitHub repository:

```text
muhammedmus/yillik-izin-takip-sistemi
```

Ana branch:

```text
main
```

İlk stabil sürüm:

```text
v1.0-stable
```

---

# Yıllık İzin Takip Sistemi

Bu repository uygulamanın kaynak kodunu ve kurulum altyapısını korumak amacıyla kullanılmaktadır.

Gerçek şirket/personel verileri kaynak kod repository'sinde saklanmamalıdır.