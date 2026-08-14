@echo off
REM ============================================================================
REM Merkoteks - RESTORE (LOCAL DATABASE'E — production'a DOKUNMAZ)
REM Kullanim:  restore.bat <backup-klasor-yolu>
REM Ornek:     restore.bat D:\PersonelIzin\data\backup\2026-08-13_1145
REM ============================================================================
setlocal
cd /d "%~dp0.."

if "%~1"=="" (
    echo [HATA] Yedek klasor yolu belirtilmedi.
    echo Kullanim: restore.bat "C:\yol\yedek-klasoru"
    pause
    exit /b 1
)
set "SRC=%~1"
if not exist "%SRC%" (
    echo [HATA] Yedek klasoru bulunamadi: %SRC%
    pause
    exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if "%%A"=="DB_NAME" set "DB_NAME=%%B"
    if "%%A"=="DATA_DIR" set "DATA_DIR=%%B"
)
set "DB_NAME=%DB_NAME: =%"
set "DATA_DIR=%DATA_DIR: =%"
if "%DB_NAME%"=="" set "DB_NAME=merkoteks_hr"

echo.
echo UYARI: Bu islem mevcut LOCAL "%DB_NAME%" veritabanini SIFIRLAR ve yedegi
echo        yerine yukler. Production'a HIC dokunulmaz.
choice /C YN /M "Devam ediyor musunuz"
if errorlevel 2 exit /b 0

echo [1/3] MongoDB restore...
docker cp "%SRC%\mongodb\%DB_NAME%.archive.gz" merkoteks-mongodb:/tmp/dump.archive
docker exec merkoteks-mongodb mongorestore --db=%DB_NAME% --archive=/tmp/dump.archive --gzip --drop
docker exec merkoteks-mongodb rm -f /tmp/dump.archive

echo [2/3] Uploads restore...
xcopy /E /I /Q /Y "%SRC%\uploads" "%DATA_DIR%\uploads" >NUL

echo [3/3] Backend restart...
docker compose restart backend

echo.
echo [OK] Restore tamamlandi. LAN URL:  http://SERVER_IP
pause
