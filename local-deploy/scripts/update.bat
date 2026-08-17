@echo off
setlocal

title Yillik Izin Takip Sistemi - Guvenli Guncelleme

echo.
echo ============================================
echo   YILLIK IZIN TAKIP SISTEMI GUNCELLEME
echo ============================================
echo.

REM Proje kok klasoru
cd /d "%~dp0\..\.."

echo [1/6] Yerel degisiklik kontrol ediliyor...

git status --porcelain > "%TEMP%\personelizin_git_status.txt"

for %%A in ("%TEMP%\personelizin_git_status.txt") do (
    if %%~zA GTR 0 (
        echo.
        echo [HATA] Git tarafinda kaydedilmemis degisiklikler var.
        echo.
        git status --short
        echo.
        echo Guncelleme guvenlik nedeniyle durduruldu.
        echo Degisiklikleri once commit edin veya iptal edin.
        del "%TEMP%\personelizin_git_status.txt" >nul 2>&1
        pause
        exit /b 1
    )
)

del "%TEMP%\personelizin_git_status.txt" >nul 2>&1

echo [OK] Git calisma alani temiz.

echo.
echo [2/6] Sistem yedegi aliniyor...

cd /d "%~dp0\.."

call scripts\backup.bat

if errorlevel 1 (
    echo.
    echo [HATA] Yedekleme basarisiz oldu.
    echo Guncelleme iptal edildi.
    pause
    exit /b 1
)

echo.
echo [3/6] GitHub'dan son kod aliniyor...

cd /d "%~dp0\..\.."

git pull --ff-only

if errorlevel 1 (
    echo.
    echo [HATA] GitHub guncellemesi alinamadi.
    echo Yerel branch ile GitHub branch'i otomatik birlestirilemedi.
    pause
    exit /b 1
)

echo.
echo [4/6] Docker image'lari yeniden olusturuluyor...

cd /d "%~dp0\.."

docker compose build

if errorlevel 1 (
    echo.
    echo [HATA] Docker build islemi basarisiz.
    pause
    exit /b 1
)

echo.
echo [5/6] Docker servisleri baslatiliyor...

docker compose up -d

if errorlevel 1 (
    echo.
    echo [HATA] Docker servisleri baslatilamadi.
    pause
    exit /b 1
)

echo.
echo [6/6] Sistem durumu kontrol ediliyor...

docker compose ps

echo.
echo ============================================
echo   GUNCELLEME TAMAMLANDI
echo ============================================
echo.
echo GitHub kodlari alindi.
echo Docker servisleri yeniden olusturuldu.
echo Guncelleme oncesi yedek alindi.
echo.
pause

endlocal