@echo off
setlocal enabledelayedexpansion

title Yillik Izin Takip Sistemi - Yedek Dogrulama

cd /d "%~dp0.."

echo.
echo ============================================================
echo   YILLIK IZIN TAKIP SISTEMI - YEDEK DOGRULAMA
echo ============================================================
echo.

REM ============================================================================
REM .env oku
REM ============================================================================
set "DATA_DIR="
set "DB_NAME="

for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /I "%%A"=="DATA_DIR" set "DATA_DIR=%%B"
    if /I "%%A"=="DB_NAME"  set "DB_NAME=%%B"
)

set "DATA_DIR=%DATA_DIR: =%"
set "DATA_DIR=%DATA_DIR:/=\%"
set "DB_NAME=%DB_NAME: =%"

if "%DB_NAME%"=="" set "DB_NAME=merkoteks_hr"

if "%DATA_DIR%"=="" (
    echo [HATA] .env icinde DATA_DIR bulunamadi.
    pause
    exit /b 1
)

set "BACKUP_ROOT=%DATA_DIR%\backup"

REM ============================================================================
REM Son tarihli yedek klasorunu bul
REM ============================================================================
set "BACKUP_DIR="

for /f "delims=" %%D in ('dir /b /ad /o-n "%BACKUP_ROOT%\20??-??-??_??????" 2^>nul') do (
    if not defined BACKUP_DIR (
        set "BACKUP_DIR=%BACKUP_ROOT%\%%D"
    )
)

if not defined BACKUP_DIR (
    echo [HATA] Yedek klasoru bulunamadi.
    echo Aranan konum:
    echo %BACKUP_ROOT%
    echo.
    pause
    exit /b 1
)

echo Son yedek:
echo %BACKUP_DIR%
echo.

REM ============================================================================
REM 1) Temel dosya kontrolu
REM ============================================================================
echo [1/5] Temel yedek dosyalari kontrol ediliyor...

set "FILES_OK=YES"

for %%F in (
    "mongodb_dump.archive.gz"
    "uploads.zip"
    "Yillik_Izin_Tum_Kayitlar.xlsx"
    "Yillik_Izin_Tum_Kayitlar.csv"
    "SON_ISLENEN_IZINLER.txt"
    "EN_SON_IZIN.txt"
    "manifest.txt"
    "SHA256.txt"
) do (
    if not exist "%BACKUP_DIR%\%%~F" (
        echo [HATA] Eksik dosya: %%~F
        set "FILES_OK=NO"
    )
)

if "%FILES_OK%"=="NO" (
    echo.
    echo [HATA] Yedek eksik.
    pause
    exit /b 1
)

echo [OK] Temel dosyalar mevcut.
echo.

REM ============================================================================
REM 2) SHA256 kontrolu
REM ============================================================================
echo [2/5] SHA256 butunlugu kontrol ediliyor...
echo.

set "SHA_BAD=0"
set "SHA_COUNT=0"

for /f "usebackq tokens=1,*" %%A in ("%BACKUP_DIR%\SHA256.txt") do (

    set "EXPECTED=%%A"
    set "FILENAME=%%B"

    if defined FILENAME (
        set "FILENAME=!FILENAME:~0!"

        if not exist "%BACKUP_DIR%\!FILENAME!" (
            echo [HATA] Eksik dosya: !FILENAME!
            set "SHA_BAD=1"
        ) else (

            set "ACTUAL="

            for /f %%H in ('powershell -NoProfile -Command "(Get-FileHash -LiteralPath '%BACKUP_DIR%\!FILENAME!' -Algorithm SHA256).Hash.ToLowerInvariant()"') do (
                set "ACTUAL=%%H"
            )

            if /I "!ACTUAL!"=="!EXPECTED!" (
                echo [OK] !FILENAME!
                set /a SHA_COUNT+=1
            ) else (
                echo [HATA] HASH UYUSMUYOR: !FILENAME!
                echo Beklenen : !EXPECTED!
                echo Gercek   : !ACTUAL!
                set "SHA_BAD=1"
            )
        )
    ) else (
        echo [HATA] Gecersiz SHA256 satiri.
        set "SHA_BAD=1"
    )
)

if "%SHA_BAD%"=="1" (
    echo.
    echo [HATA] SHA256 dogrulamasi basarisiz.
    echo Dosyalardan biri degismis veya bozulmus olabilir.
    echo.
    pause
    exit /b 1
)

if "%SHA_COUNT%"=="0" (
    echo.
    echo [HATA] SHA256.txt icinde gecerli hash bulunamadi.
    pause
    exit /b 1
)

echo.
echo [OK] Tum SHA256 hash degerleri dogru.
echo Dogrulanan dosya sayisi: %SHA_COUNT%
echo.

REM ============================================================================
REM 3) MongoDB archive container'a kopyala
REM ============================================================================
echo [3/5] MongoDB yedegi test icin hazirlaniyor...

docker cp "%BACKUP_DIR%\mongodb_dump.archive.gz" merkoteks-mongodb:/tmp/backup_verify.archive.gz

if errorlevel 1 (
    echo.
    echo [HATA] MongoDB yedegi container'a kopyalanamadi.
    pause
    exit /b 1
)

echo [OK] MongoDB archive hazir.
echo.

REM ============================================================================
REM 4) Gecici test DB restore
REM ============================================================================
echo [4/5] MongoDB yedegi gecici test veritabanina restore ediliyor...
echo.

set "TEST_DB=%DB_NAME%_restore_test"

REM Eski test DB varsa sil
docker exec merkoteks-mongodb mongosh --quiet --eval "db.getSiblingDB('%TEST_DB%').dropDatabase()" >nul 2>&1

REM Yedegi test DB'ye restore et
docker exec merkoteks-mongodb mongorestore --gzip --archive=/tmp/backup_verify.archive.gz --nsFrom="%DB_NAME%.*" --nsTo="%TEST_DB%.*"

if errorlevel 1 (
    echo.
    echo [HATA] MongoDB test restore basarisiz.

    docker exec merkoteks-mongodb rm -f /tmp/backup_verify.archive.gz >nul 2>&1

    pause
    exit /b 1
)

echo.
echo [OK] MongoDB test restore basarili.
echo.

REM ============================================================================
REM 5) Kayit sayilari ve temizlik
REM ============================================================================
echo [5/5] Test veritabani kontrol ediliyor...
echo.

set "PERSONNEL_COUNT=0"
set "LEAVE_COUNT=0"
set "COLLECTION_COUNT=0"

for /f %%C in ('docker exec merkoteks-mongodb mongosh "%TEST_DB%" --quiet --eval "db.personnel.countDocuments({})"') do (
    set "PERSONNEL_COUNT=%%C"
)

for /f %%C in ('docker exec merkoteks-mongodb mongosh "%TEST_DB%" --quiet --eval "db.leaves.countDocuments({})"') do (
    set "LEAVE_COUNT=%%C"
)

for /f %%C in ('docker exec merkoteks-mongodb mongosh "%TEST_DB%" --quiet --eval "db.getCollectionNames().length"') do (
    set "COLLECTION_COUNT=%%C"
)

echo Personel kaydi : %PERSONNEL_COUNT%
echo Izin kaydi     : %LEAVE_COUNT%
echo Koleksiyon     : %COLLECTION_COUNT%
echo.

if "%COLLECTION_COUNT%"=="0" (
    echo [HATA] Test veritabaninda koleksiyon bulunamadi.

    docker exec merkoteks-mongodb mongosh --quiet --eval "db.getSiblingDB('%TEST_DB%').dropDatabase()" >nul 2>&1
    docker exec merkoteks-mongodb rm -f /tmp/backup_verify.archive.gz >nul 2>&1

    pause
    exit /b 1
)

REM ============================================================================
REM Test veritabanini temizle
REM ============================================================================
docker exec merkoteks-mongodb mongosh --quiet --eval "db.getSiblingDB('%TEST_DB%').dropDatabase()" >nul 2>&1

if errorlevel 1 (
    echo [UYARI] Test veritabani otomatik silinemedi.
) else (
    echo [OK] Gecici test veritabani silindi.
)

docker exec merkoteks-mongodb rm -f /tmp/backup_verify.archive.gz >nul 2>&1

echo.
echo ============================================================
echo   YEDEK DOGRULAMA BASARILI
echo ============================================================
echo.

echo Son yedek:
echo %BACKUP_DIR%
echo.

echo SHA256        : OK
echo Hash dosyasi  : %SHA_COUNT%
echo Mongo restore : OK
echo Personel      : %PERSONNEL_COUNT%
echo Izin          : %LEAVE_COUNT%
echo Koleksiyon    : %COLLECTION_COUNT%
echo.
echo Bu yedek geri yuklenebilir durumda.
echo.

echo ============================================================
echo.

pause
endlocal