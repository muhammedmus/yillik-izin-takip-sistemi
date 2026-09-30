@echo off
setlocal

REM ============================================================
REM   PERSONEL LISTESI (ISE GIRIS / ISTEN CIKIS) DISA AKTARIMI
REM   Personel Canli Takip -> Devam Takvimi puantaji icin kullanilir.
REM   Veritabanina yazmaz, sadece okur. daily_leave_log.bat sonunda
REM   da otomatik calistirilir.
REM ============================================================

set "HOST_FILE=%~dp0..\..\data\backup\Personel_Listesi.xlsx"

echo [Personel] Script backend container'a kopyalaniyor...
docker cp "%~dp0personel_export.py" merkoteks-backend:/tmp/personel_export.py
if errorlevel 1 (
    echo   HATA: Script kopyalanamadi. Docker calisiyor mu kontrol edin.
    exit /b 1
)

echo [Personel] Liste olusturuluyor...
docker exec merkoteks-backend python3 /tmp/personel_export.py
if errorlevel 1 (
    echo   HATA: Personel listesi olusturulamadi.
    exit /b 1
)

if not exist "%~dp0..\..\data\backup" mkdir "%~dp0..\..\data\backup"
docker cp merkoteks-backend:/tmp/Personel_Listesi.xlsx "%HOST_FILE%"
if errorlevel 1 (
    echo   HATA: Dosya host'a kopyalanamadi.
    exit /b 1
)
echo   Personel listesi : %HOST_FILE%

endlocal
