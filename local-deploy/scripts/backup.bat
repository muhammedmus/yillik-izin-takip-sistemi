@echo off
REM ============================================================================
REM Yillik Izin Takip Sistemi - BACKUP v4
REM Locale-independent + robust + SHA256
REM Cikti: %DATA_DIR%\backup\YYYY-MM-DD_HHMMSS\
REM
REM NOT (v4): Yillik izin Excel/CSV/TXT disa aktarim adimi kaldirildi. Bu ihtiyac
REM artik ayri bir script (daily_leave_log.bat) tarafindan, "Guncel_Yillik_Izin.xlsx"
REM ve "gunluk_izinler\" klasoru olarak, daha uygun formatta karsilaniyor.
REM Bu script artik yalnizca gercek felaket-kurtarma yedegine (MongoDB + uploads)
REM odaklaniyor.
REM ============================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0.."

REM ============================================================================
REM .env oku
REM ============================================================================
set "DATA_DIR="
set "DB_NAME="

for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /I "%%A"=="DATA_DIR" set "DATA_DIR=%%B"
    if /I "%%A"=="DB_NAME"  set "DB_NAME=%%B"
)

REM Bosluklari temizle
set "DATA_DIR=%DATA_DIR: =%"
set "DATA_DIR=%DATA_DIR:/=\%"
set "DB_NAME=%DB_NAME: =%"

REM Mevcut sistemle uyumluluk icin varsayilan DB
if "%DB_NAME%"=="" set "DB_NAME=merkoteks_hr"

if "%DATA_DIR%"=="" (
    echo [HATA] .env icinde DATA_DIR yok.
    exit /b 1
)

REM ============================================================================
REM Locale-independent timestamp
REM ============================================================================
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HHmmss'"`) do set "STAMP=%%T"

if "%STAMP%"=="" (
    echo [HATA] PowerShell timestamp uretilemedi.
    exit /b 1
)

set "OUT=%DATA_DIR%\backup\%STAMP%"

echo.
echo ============================================================
echo   YILLIK IZIN TAKIP SISTEMI YEDEKLEME
echo ============================================================
echo.
echo Tarih       : %STAMP%
echo Hedef klasor: "%OUT%"
echo.

mkdir "%OUT%" 2>NUL

if not exist "%OUT%" (
    echo [HATA] Klasor olusturulamadi:
    echo "%OUT%"
    exit /b 1
)

REM ============================================================================
REM Baslangic durumlari
REM ============================================================================
set "MONGO_OK=FAIL"
set "UPLOADS_OK=FAIL"
set "MANIFEST_OK=FAIL"
set "SHA_OK=FAIL"

set "MONGO_SIZE=0"
set "UPLOADS_FILES=0"

REM ============================================================================
REM 1) MongoDB dump
REM ============================================================================
echo [1/5] MongoDB dump aliniyor...

docker exec merkoteks-mongodb sh -c "rm -f /tmp/mongodb_dump.archive && mongodump --db=%DB_NAME% --archive=/tmp/mongodb_dump.archive --gzip"

if errorlevel 1 goto :after_mongo

docker cp merkoteks-mongodb:/tmp/mongodb_dump.archive "%OUT%\mongodb_dump.archive.gz"

docker exec merkoteks-mongodb rm -f /tmp/mongodb_dump.archive 2>NUL

if exist "%OUT%\mongodb_dump.archive.gz" (
    for %%A in ("%OUT%\mongodb_dump.archive.gz") do set "MONGO_SIZE=%%~zA"

    if !MONGO_SIZE! GTR 0 (
        set "MONGO_OK=OK"
    )
)

:after_mongo

echo   MongoDB : %MONGO_OK%
echo   Boyut   : %MONGO_SIZE% B
echo.

REM ============================================================================
REM 2) Uploads backup
REM ============================================================================
echo [2/5] Uploads yedegi aliniyor...

docker exec merkoteks-backend sh -c "cd /data && rm -f /tmp/uploads.zip && (which zip >/dev/null 2>&1 || (apt-get update >/dev/null 2>&1 && apt-get install -y zip >/dev/null 2>&1)) && zip -qr /tmp/uploads.zip uploads 2>/dev/null; ls /data/uploads 2>/dev/null | wc -l"

docker cp merkoteks-backend:/tmp/uploads.zip "%OUT%\uploads.zip" 2>NUL

docker exec merkoteks-backend rm -f /tmp/uploads.zip 2>NUL

if exist "%OUT%\uploads.zip" (
    for %%A in ("%OUT%\uploads.zip") do (
        if %%~zA GTR 0 set "UPLOADS_OK=OK"
    )

    for /f %%C in ('docker exec merkoteks-backend sh -c "find /data/uploads -type f 2^>/dev/null ^| wc -l"') do (
        set "UPLOADS_FILES=%%C"
    )
)

echo   Uploads : %UPLOADS_OK%
echo   Dosya   : %UPLOADS_FILES%
echo.

REM ============================================================================
REM 3) Manifest
REM ============================================================================
echo [3/5] Manifest olusturuluyor...

(
    echo Backup Date                : %STAMP%
    echo Backup Path                : %OUT%
    echo MongoDB backup             : %MONGO_OK%   size=%MONGO_SIZE% B
    echo Uploads backup             : %UPLOADS_OK%   files=%UPLOADS_FILES%
) > "%OUT%\manifest.txt"

if exist "%OUT%\manifest.txt" (
    set "MANIFEST_OK=OK"
)

echo   Manifest : %MANIFEST_OK%
echo.

REM ============================================================================
REM 4) SHA256
REM ============================================================================
echo [4/5] SHA256 hash degerleri olusturuluyor...

if exist "%OUT%\SHA256.txt" (
    del "%OUT%\SHA256.txt"
)

for %%F in (
    "mongodb_dump.archive.gz"
    "uploads.zip"
    "manifest.txt"
) do (
    if exist "%OUT%\%%~F" (
        for /f %%H in ('powershell -NoProfile -Command "(Get-FileHash -LiteralPath '%OUT%\%%~F' -Algorithm SHA256).Hash.ToLowerInvariant()"') do (
            echo %%H  %%~F>>"%OUT%\SHA256.txt"
        )
    )
)

set "SHA_OK=FAIL"

if exist "%OUT%\SHA256.txt" (
    for %%A in ("%OUT%\SHA256.txt") do (
        if %%~zA GTR 50 (
            set "SHA_OK=OK"
        )
    )
)

echo   SHA256 : %SHA_OK%
echo.

REM ============================================================================
REM 5) Final summary
REM ============================================================================
echo.
echo ============================================================
echo   YEDEKLEME OZETI
echo ============================================================
echo.

echo Klasor         : %OUT%
echo MongoDB backup : %MONGO_OK%  (size=%MONGO_SIZE% B)
echo Uploads backup : %UPLOADS_OK%  (files=%UPLOADS_FILES%)
echo Manifest       : %MANIFEST_OK%
echo SHA256         : %SHA_OK%
echo.

echo Yedek dosyalari:
dir "%OUT%" /B

echo.

REM ============================================================================
REM Final success / failure
REM ============================================================================
if "%MONGO_OK%"=="OK" (
    if "%UPLOADS_OK%"=="OK" (
        if "%MANIFEST_OK%"=="OK" (
            if "%SHA_OK%"=="OK" (
                echo ============================================================
                echo [OK] Tum yedekleme adimlari basarili.
                echo ============================================================
                exit /b 0
            )
        )
    )
)

echo ============================================================
echo [HATA] Bir veya daha fazla yedekleme adimi basarisiz.
echo Yukaridaki ozeti kontrol edin.
echo ============================================================

exit /b 1
