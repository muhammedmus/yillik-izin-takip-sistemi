@echo off
REM ============================================================================
REM Merkoteks - PRODUCTION YEDEGINI LOCAL'E ICE AKTAR
REM ============================================================================
REM Bu betik production yedek dosyalarindan (mongodump + Object Storage blob'lari)
REM LOCAL sisteme yukler. Production ortamina DOKUNMAZ.
REM
REM Gereksinim: elinizde iki dosya olmali:
REM   1. mrk_dump_YYYYMMDD.tar.gz         (MongoDB dump — 13 collection)
REM   2. mrk_blobs_YYYYMMDD.tar.gz        (Object Storage belgeler)
REM
REM Kullanim:
REM   migrate-from-prod.bat  C:\indirilenler\mrk_dump_20260813.tar.gz  C:\indirilenler\mrk_blobs_20260813.tar.gz
REM ============================================================================
setlocal
cd /d "%~dp0.."

if "%~1"=="" (
    echo Kullanim: migrate-from-prod.bat DUMP_TAR_GZ BLOBS_TAR_GZ
    pause
    exit /b 1
)
if "%~2"=="" (
    echo Kullanim: migrate-from-prod.bat DUMP_TAR_GZ BLOBS_TAR_GZ
    pause
    exit /b 1
)
set "DUMP=%~1"
set "BLOBS=%~2"

for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if "%%A"=="DB_NAME"  set "DB_NAME=%%B"
    if "%%A"=="DATA_DIR" set "DATA_DIR=%%B"
)
set "DB_NAME=%DB_NAME: =%"
set "DATA_DIR=%DATA_DIR: =%"
if "%DB_NAME%"=="" set "DB_NAME=merkoteks_hr"

echo.
echo Yuklenecek:
echo   Dump  : %DUMP%
echo   Blobs : %BLOBS%
echo   Hedef : LOCAL Docker MongoDB ("%DB_NAME%")  +  %DATA_DIR%\uploads
echo.
choice /C YN /M "Local veriler UZERINE yazilacak. Devam"
if errorlevel 2 exit /b 0

echo [1/4] Dump extract...
set "TMPD=%TEMP%\mrk_migrate_%RANDOM%"
mkdir "%TMPD%"
tar -xzf "%DUMP%" -C "%TMPD%"

echo [2/4] MongoDB restore (mongodump native format)...
REM Container icine kopyala + restore et
for /d %%D in ("%TMPD%\mrk_dump_*") do set "EXDIR=%%D"
docker cp "%EXDIR%\%DB_NAME%" merkoteks-mongodb:/tmp/dump_data
docker exec merkoteks-mongodb mongorestore --db=%DB_NAME% --gzip --drop /tmp/dump_data
docker exec merkoteks-mongodb rm -rf /tmp/dump_data

echo [3/4] Object Storage blob'lari uploads klasorune yerlestir...
set "TMPB=%TEMP%\mrk_blobs_%RANDOM%"
mkdir "%TMPB%"
tar -xzf "%BLOBS%" -C "%TMPB%"

REM Blob'lari orijinal storage_path'e uygun yerlestir (manifest.json'dan)
docker cp "%TMPB%" merkoteks-backend:/tmp/blobs_import
docker exec merkoteks-backend python -c "import json,os,shutil,glob; d=glob.glob('/tmp/blobs_import/mrk_blobs_*')[0]; m=json.load(open(d+'/manifest.json')); [shutil.copy(d+'/'+x['attachment_id']+'__'+x['original_filename'], os.makedirs(os.path.dirname('/data/uploads/'+x['storage_path_preview']),exist_ok=True) or '/data/uploads/'+x['storage_path_preview']) for x in m if x.get('download_status')=='OK']; print('blobs imported:', sum(1 for x in m if x.get('download_status')=='OK'))"
docker exec merkoteks-backend rm -rf /tmp/blobs_import

echo [4/4] Temizle + backend restart...
rmdir /S /Q "%TMPD%"
rmdir /S /Q "%TMPB%"
docker compose restart backend

echo.
echo [OK] Production yedegi LOCAL sisteme aktarildi.
echo Kontrol icin:  http://localhost/  ->  giris yapin
pause
