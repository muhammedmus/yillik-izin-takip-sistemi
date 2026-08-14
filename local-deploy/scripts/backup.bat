@echo off
REM ============================================================================
REM Merkoteks - BACKUP v2 (locale-independent + robust)
REM Cikti: %DATA_DIR%\backup\YYYY-MM-DD_HHMMSS\
REM ============================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0.."

REM ---- .env oku (DATA_DIR + DB_NAME) ----
set "DATA_DIR="
set "DB_NAME="
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /I "%%A"=="DATA_DIR" set "DATA_DIR=%%B"
    if /I "%%A"=="DB_NAME"  set "DB_NAME=%%B"
)
REM Kirp bosluklari + forward slash -> backslash normalize
set "DATA_DIR=%DATA_DIR: =%"
set "DATA_DIR=%DATA_DIR:/=\%"
set "DB_NAME=%DB_NAME: =%"
if "%DB_NAME%"=="" set "DB_NAME=merkoteks_hr"
if "%DATA_DIR%"=="" (
    echo [HATA] .env icinde DATA_DIR yok.
    exit /b 1
)

REM ---- Locale-INDEPENDENT timestamp (PowerShell) ----
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HHmmss'"`) do set "STAMP=%%T"
if "%STAMP%"=="" (
    echo [HATA] PowerShell timestamp uretilemedi.
    exit /b 1
)
set "OUT=%DATA_DIR%\backup\%STAMP%"

echo === MERKOTEKS BACKUP  %STAMP%  ===
echo Hedef klasor: "%OUT%"
mkdir "%OUT%" 2>NUL
if not exist "%OUT%" (
    echo [HATA] Klasor olusturulamadi: "%OUT%"
    exit /b 1
)

set "MONGO_OK=FAIL"
set "UPLOADS_OK=FAIL"
set "EXPORT_OK=FAIL"
set "MANIFEST_OK=FAIL"
set "SHA_OK=FAIL"
set "LATEST_OK=FAIL"
set "MONGO_COUNT=0"
set "EXCEL_COUNT=0"
set "CSV_COUNT=0"
set "COUNTS_MATCH=NO"
set "MONGO_SIZE=0"
set "UPLOADS_FILES=0"

REM ============================================================
REM 1) MongoDB dump (container icinden, dosya var + size > 0 kontrolu)
REM ============================================================
echo [1/7] MongoDB dump...
docker exec merkoteks-mongodb sh -c "rm -f /tmp/mongodb_dump.archive && mongodump --db=%DB_NAME% --archive=/tmp/mongodb_dump.archive --gzip"
if errorlevel 1 goto :after_mongo
docker cp merkoteks-mongodb:/tmp/mongodb_dump.archive "%OUT%\mongodb_dump.archive.gz"
docker exec merkoteks-mongodb rm -f /tmp/mongodb_dump.archive 2>NUL
if exist "%OUT%\mongodb_dump.archive.gz" (
    for %%A in ("%OUT%\mongodb_dump.archive.gz") do set "MONGO_SIZE=%%~zA"
    if !MONGO_SIZE! GTR 0 set "MONGO_OK=OK"
)
:after_mongo
echo   → %MONGO_OK%  (size=%MONGO_SIZE% B)

REM ============================================================
REM 2) Uploads backup - backend container'in /data/uploads'ini zip
REM ============================================================
echo [2/7] Uploads backup (container /data/uploads)...
docker exec merkoteks-backend sh -c "cd /data && rm -f /tmp/uploads.zip && (which zip >/dev/null 2>&1 || (apt-get update >/dev/null 2>&1 && apt-get install -y zip >/dev/null 2>&1)) && zip -qr /tmp/uploads.zip uploads 2>/dev/null; ls /data/uploads 2>/dev/null | wc -l"
docker cp merkoteks-backend:/tmp/uploads.zip "%OUT%\uploads.zip" 2>NUL
docker exec merkoteks-backend rm -f /tmp/uploads.zip 2>NUL
if exist "%OUT%\uploads.zip" (
    for %%A in ("%OUT%\uploads.zip") do if %%~zA GTR 0 set "UPLOADS_OK=OK"
    for /f %%C in ('docker exec merkoteks-backend sh -c "find /data/uploads -type f 2^>/dev/null ^| wc -l"') do set "UPLOADS_FILES=%%C"
)
echo   → %UPLOADS_OK%  (files=%UPLOADS_FILES%)

REM ============================================================
REM 3) Annual leave export (XLSX + CSV + TXT + EN_SON) - real file check
REM ============================================================
echo [3/7] Yillik izin export...
docker cp scripts\export_leaves.py merkoteks-backend:/tmp/export_leaves.py
docker exec merkoteks-backend sh -c "rm -rf /tmp/backup_out && mkdir -p /tmp/backup_out && python /tmp/export_leaves.py /tmp/backup_out" > "%TEMP%\mrk_export.txt" 2>&1
type "%TEMP%\mrk_export.txt" | findstr /R "^MONGO_COUNT= ^EXCEL_ROW_COUNT= ^CSV_ROW_COUNT= ^COUNTS_MATCH="
for /f "usebackq tokens=1,2 delims==" %%X in ("%TEMP%\mrk_export.txt") do (
    if "%%X"=="MONGO_COUNT"     set "MONGO_COUNT=%%Y"
    if "%%X"=="EXCEL_ROW_COUNT" set "EXCEL_COUNT=%%Y"
    if "%%X"=="CSV_ROW_COUNT"   set "CSV_COUNT=%%Y"
    if "%%X"=="COUNTS_MATCH"    set "COUNTS_MATCH=%%Y"
)
docker cp merkoteks-backend:/tmp/backup_out/Yillik_Izin_Tum_Kayitlar.xlsx "%OUT%\Yillik_Izin_Tum_Kayitlar.xlsx" 2>NUL
docker cp merkoteks-backend:/tmp/backup_out/Yillik_Izin_Tum_Kayitlar.csv  "%OUT%\Yillik_Izin_Tum_Kayitlar.csv"  2>NUL
docker cp merkoteks-backend:/tmp/backup_out/SON_ISLENEN_IZINLER.txt      "%OUT%\SON_ISLENEN_IZINLER.txt"       2>NUL
docker cp merkoteks-backend:/tmp/backup_out/EN_SON_IZIN.txt              "%OUT%\EN_SON_IZIN.txt"               2>NUL
docker exec merkoteks-backend rm -rf /tmp/backup_out /tmp/export_leaves.py 2>NUL

REM Gercek dosya varlik kontrolu (Python exit code'una degil size'a bakiyoruz)
set "X_XLSX=FAIL" & set "X_CSV=FAIL" & set "X_TXT=FAIL" & set "X_LAST=FAIL"
if exist "%OUT%\Yillik_Izin_Tum_Kayitlar.xlsx" for %%A in ("%OUT%\Yillik_Izin_Tum_Kayitlar.xlsx") do if %%~zA GTR 1000 set "X_XLSX=OK"
if exist "%OUT%\Yillik_Izin_Tum_Kayitlar.csv"  for %%A in ("%OUT%\Yillik_Izin_Tum_Kayitlar.csv")  do if %%~zA GTR 100  set "X_CSV=OK"
if exist "%OUT%\SON_ISLENEN_IZINLER.txt"       for %%A in ("%OUT%\SON_ISLENEN_IZINLER.txt")       do if %%~zA GTR 100  set "X_TXT=OK"
if exist "%OUT%\EN_SON_IZIN.txt"                for %%A in ("%OUT%\EN_SON_IZIN.txt")               do if %%~zA GTR 50   set "X_LAST=OK"
if "%X_XLSX%%X_CSV%%X_TXT%%X_LAST%"=="OKOKOKOK" if "%COUNTS_MATCH%"=="YES" set "EXPORT_OK=OK"
echo   → XLSX:%X_XLSX% CSV:%X_CSV% TXT:%X_TXT% LAST:%X_LAST%  Export:%EXPORT_OK%

REM ============================================================
REM 4) Manifest
REM ============================================================
echo [4/7] Manifest...
(
  echo Backup Date                : %STAMP%
  echo Backup Path                : %OUT%
  echo MongoDB backup             : %MONGO_OK%   size=%MONGO_SIZE% B
  echo Uploads backup             : %UPLOADS_OK%   files=%UPLOADS_FILES%
  echo Annual leave Excel         : %X_XLSX%
  echo Annual leave CSV           : %X_CSV%
  echo Last processed TXT         : %X_TXT%
  echo Last leave TXT             : %X_LAST%
  echo Annual leave record count  : %MONGO_COUNT%
  echo Excel row count            : %EXCEL_COUNT%
  echo CSV row count              : %CSV_COUNT%
  echo Counts match               : %COUNTS_MATCH%
) > "%OUT%\manifest.txt"
if exist "%OUT%\manifest.txt" set "MANIFEST_OK=OK"
echo   → %MANIFEST_OK%

REM ============================================================
REM 5) SHA256
REM ============================================================
echo [5/7] SHA256...
if exist "%OUT%\SHA256.txt" del "%OUT%\SHA256.txt"
for %%F in ("mongodb_dump.archive.gz" "uploads.zip" "Yillik_Izin_Tum_Kayitlar.xlsx" "Yillik_Izin_Tum_Kayitlar.csv" "SON_ISLENEN_IZINLER.txt" "EN_SON_IZIN.txt" "manifest.txt") do (
    if exist "%OUT%\%%~F" (
        for /f "skip=1 tokens=*" %%H in ('certutil -hashfile "%OUT%\%%~F" SHA256 2^>NUL ^| findstr /R /C:"^[0-9a-f]"') do (
            echo %%H  %%~F >> "%OUT%\SHA256.txt"
        )
    )
)
if exist "%OUT%\SHA256.txt" set "SHA_OK=OK"
echo   → %SHA_OK%

REM ============================================================
REM 6) GUNCEL (always-latest) atomic update
REM ============================================================
echo [6/7] Guncel dosyalar (atomic)...
set "LATEST_XLSX=%DATA_DIR%\backup\GUNCEL_YILLIK_IZINLER.xlsx"
set "LATEST_TXT=%DATA_DIR%\backup\EN_SON_IZIN.txt"
if "%EXPORT_OK%"=="OK" if "%COUNTS_MATCH%"=="YES" (
    copy /Y "%OUT%\Yillik_Izin_Tum_Kayitlar.xlsx" "%LATEST_XLSX%.new" >NUL 2>&1
    copy /Y "%OUT%\EN_SON_IZIN.txt"                "%LATEST_TXT%.new"  >NUL 2>&1
    set "TMP_OK=YES"
    if not exist "%LATEST_XLSX%.new" set "TMP_OK=NO"
    if not exist "%LATEST_TXT%.new"  set "TMP_OK=NO"
    for %%A in ("%LATEST_XLSX%.new") do if %%~zA LSS 1000 set "TMP_OK=NO"
    for %%A in ("%LATEST_TXT%.new")  do if %%~zA LSS 50   set "TMP_OK=NO"
    if "!TMP_OK!"=="YES" (
        move /Y "%LATEST_XLSX%.new" "%LATEST_XLSX%" >NUL
        move /Y "%LATEST_TXT%.new"  "%LATEST_TXT%"  >NUL
        set "LATEST_OK=OK"
    ) else (
        del /Q "%LATEST_XLSX%.new" 2>NUL
        del /Q "%LATEST_TXT%.new"  2>NUL
    )
)
echo   → %LATEST_OK%

REM ============================================================
REM 7) Final summary
REM ============================================================
echo.
echo === BACKUP SUMMARY ===
echo Klasor         : %OUT%
echo MongoDB backup : %MONGO_OK%  (size=%MONGO_SIZE% B)
echo Uploads backup : %UPLOADS_OK%  (files=%UPLOADS_FILES%)
echo Export         : %EXPORT_OK%
echo Counts         : mongo=%MONGO_COUNT% excel=%EXCEL_COUNT% csv=%CSV_COUNT% match=%COUNTS_MATCH%
echo Manifest       : %MANIFEST_OK%
echo SHA256         : %SHA_OK%
echo Latest files   : %LATEST_OK%
echo.
dir "%OUT%" /B

if "%MONGO_OK%"=="OK" if "%UPLOADS_OK%"=="OK" if "%EXPORT_OK%"=="OK" if "%COUNTS_MATCH%"=="YES" if "%MANIFEST_OK%"=="OK" if "%SHA_OK%"=="OK" if "%LATEST_OK%"=="OK" (
    echo [OK] Tum adimlar basarili.
    exit /b 0
)
echo [HATA] Bir veya daha fazla adim basarisiz. Yukaridaki listeyi kontrol edin.
exit /b 1
