@echo off
setlocal

title Yillik Izin Takip Sistemi - Guncelleme

echo.
echo ============================================
echo   YILLIK IZIN TAKIP SISTEMI GUNCELLEME
echo ============================================
echo.

cd /d "%~dp0\.."

echo [1/5] Sistem yedegi aliniyor...
call scripts\backup.bat

if errorlevel 1 (
    echo.
    echo [HATA] Yedekleme basarisiz oldu.
    echo Guncelleme iptal edildi.
    pause
    exit /b 1
)

echo.
echo [2/5] GitHub'dan son kod aliniyor...
cd /d "%~dp0\..\.."
git pull

if errorlevel 1 (
    echo.
    echo [HATA] GitHub guncellemesi alinamadi.
    pause
    exit /b 1
)

echo.
echo [3/5] Docker image'lari yeniden olusturuluyor...
cd /d "%~dp0\.."
docker compose build

if errorlevel 1 (
    echo.
    echo [HATA] Docker build islemi basarisiz.
    pause
    exit /b 1
)

echo.
echo [4/5] Docker servisleri baslatiliyor...
docker compose up -d

if errorlevel 1 (
    echo.
    echo [HATA] Docker servisleri baslatilamadi.
    pause
    exit /b 1
)

echo.
echo [5/5] Sistem durumu kontrol ediliyor...
docker compose ps

echo.
echo ============================================
echo   GUNCELLEME TAMAMLANDI
echo ============================================
echo.
pause