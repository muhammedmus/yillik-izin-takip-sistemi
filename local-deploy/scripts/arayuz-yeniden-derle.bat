@echo off
setlocal
title Izin Sistemi - Arayuz Yeniden Derleme

REM Sadece arayuzu (nginx + React) yeniden derler. Veritabanina ve
REM backend'e dokunmaz. Raporlar sayfasina "Departman" sutunu eklendi.

cd /d "%~dp0.."

echo.
echo Arayuz yeniden derleniyor (birkac dakika surebilir)...
docker compose build nginx
if errorlevel 1 (
    echo.
    echo [HATA] Derleme basarisiz. Yukaridaki mesaja bakin.
    pause
    exit /b 1
)

echo.
echo Arayuz yeniden baslatiliyor...
docker compose up -d nginx
if errorlevel 1 (
    echo.
    echo [HATA] Arayuz baslatilamadi.
    pause
    exit /b 1
)

echo.
echo [OK] Tamamlandi. Tarayicida Ctrl+F5 ile sayfayi yenileyin.
pause
endlocal
