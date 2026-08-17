@echo off
setlocal

title Yillik Izin Takip Sistemi - Sistem Kontrolu

echo.
echo ============================================
echo   YILLIK IZIN TAKIP SISTEMI SAGLIK KONTROLU
echo ============================================
echo.

cd /d "%~dp0\.."

echo [1/5] Docker kontrol ediliyor...
docker info >nul 2>&1

if errorlevel 1 (
    echo [HATA] Docker Desktop calismiyor.
    echo Docker Desktop'i baslatip tekrar deneyin.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker calisiyor.
echo.

echo [2/5] Container durumlari kontrol ediliyor...
echo.
docker compose ps

echo.
echo [3/5] Backend kontrol ediliyor...

set "BACKEND_HEALTH="
for /f "delims=" %%A in ('docker inspect --format="{{.State.Health.Status}}" merkoteks-backend 2^>nul') do set "BACKEND_HEALTH=%%A"

if /I "%BACKEND_HEALTH%"=="healthy" (
    echo [OK] Backend healthy
) else (
    if "%BACKEND_HEALTH%"=="" (
        echo [HATA] Backend container bulunamadi veya calismiyor.
    ) else (
        echo [UYARI] Backend durumu: %BACKEND_HEALTH%
    )
)

echo.
echo [4/5] MongoDB kontrol ediliyor...

set "MONGO_HEALTH="
for /f "delims=" %%A in ('docker inspect --format="{{.State.Health.Status}}" merkoteks-mongodb 2^>nul') do set "MONGO_HEALTH=%%A"

if /I "%MONGO_HEALTH%"=="healthy" (
    echo [OK] MongoDB healthy
) else (
    if "%MONGO_HEALTH%"=="" (
        echo [HATA] MongoDB container bulunamadi veya calismiyor.
    ) else (
        echo [UYARI] MongoDB durumu: %MONGO_HEALTH%
    )
)

echo.
echo [5/5] Nginx kontrol ediliyor...

set "NGINX_HEALTH="
for /f "delims=" %%A in ('docker inspect --format="{{.State.Health.Status}}" merkoteks-nginx 2^>nul') do set "NGINX_HEALTH=%%A"

if /I "%NGINX_HEALTH%"=="healthy" (
    echo [OK] Nginx healthy
) else (
    if "%NGINX_HEALTH%"=="" (
        echo [HATA] Nginx container bulunamadi veya calismiyor.
    ) else (
        echo [UYARI] Nginx durumu: %NGINX_HEALTH%
    )
)

echo.
echo ============================================
echo   SISTEM KONTROLU TAMAMLANDI
echo ============================================
echo.

echo Backend : %BACKEND_HEALTH%
echo MongoDB : %MONGO_HEALTH%
echo Nginx   : %NGINX_HEALTH%
echo.

pause
endlocal