@echo off
setlocal

set "HOST_MASTER=%~dp0..\..\data\backup\Guncel_Yillik_Izin.xlsx"
set "HOST_DAILY_DIR=%~dp0..\..\data\backup\gunluk_izinler"
set "CONTAINER_MASTER=/tmp/Guncel_Yillik_Izin.xlsx"
set "CONTAINER_DAILY_DIR=/tmp/gunluk_izinler"

echo ============================================================
echo   GUNLUK IZIN DOSYALARI + GUNCEL YILLIK IZIN
echo ============================================================
echo.

echo [1/5] Script backend container'a kopyalaniyor...
docker cp "%~dp0daily_leave_log_export.py" merkoteks-backend:/tmp/daily_leave_log_export.py
if errorlevel 1 (
    echo   HATA: Script kopyalanamadi. Docker calisiyor mu, container adi dogru mu kontrol edin.
    exit /b 1
)
echo   Kopyalandi : OK
docker exec merkoteks-backend rm -rf %CONTAINER_DAILY_DIR%

echo.
echo [2/5] Container'daki eski gecici dosya temizleniyor...
docker exec merkoteks-backend rm -f %CONTAINER_MASTER%
echo   Temizlendi : OK

echo.
echo [2b/5] Var olan Guncel Yillik Izin dosyasi (varsa) container'a aktariliyor...
if exist "%HOST_MASTER%" (
    docker cp "%HOST_MASTER%" merkoteks-backend:%CONTAINER_MASTER%
    echo   Mevcut dosya bulundu, uzerine eklenecek : OK
) else (
    echo   Henuz dosya yok, ilk kez olusturulacak : OK
)

echo.
echo [3/5] Rapor guncelleniyor (yeni kayitlar + bugunun gunluk dosyasi)...
docker exec merkoteks-backend python3 /tmp/daily_leave_log_export.py
if errorlevel 1 (
    echo   HATA: Rapor olusturulamadi. Yukaridaki hata mesajina bakin.
    exit /b 1
)

echo.
echo [4/5] Guncel Yillik Izin dosyasi host'a geri kopyalaniyor...
if not exist "%~dp0..\..\data\backup" mkdir "%~dp0..\..\data\backup"
docker cp merkoteks-backend:%CONTAINER_MASTER% "%HOST_MASTER%"
if errorlevel 1 (
    echo   HATA: Dosya host'a kopyalanamadi.
    exit /b 1
)
echo   Kopyalandi : OK

echo.
echo [5/5] Bugunun gunluk dosyasi (varsa) host'a kopyalaniyor...
if not exist "%HOST_DAILY_DIR%" mkdir "%HOST_DAILY_DIR%"
docker cp merkoteks-backend:%CONTAINER_DAILY_DIR%/. "%HOST_DAILY_DIR%" >nul 2>&1
echo   Senkronize edildi : OK

echo.
echo ============================================================
echo   [OK] Islem tamamlandi.
echo   Guncel Yillik Izin : %HOST_MASTER%
echo   Gunluk dosyalar    : %HOST_DAILY_DIR%
echo ============================================================

endlocal
