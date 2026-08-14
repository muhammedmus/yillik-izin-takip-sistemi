@echo off
REM ============================================================================
REM Merkoteks Personel Sistemi - LOCAL START
REM ============================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0.."

if not exist .env (
    echo [HATA] .env dosyasi yok. Once .env.example kopyalayin:
    echo         copy .env.example .env
    echo Ardindan .env icindeki JWT_SECRET, ADMIN_PASSWORD ve DATA_DIR degerlerini duzenleyin.
    pause
    exit /b 1
)

echo [BILGI] .env icinden DATA_DIR okunuyor...
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if "%%A"=="DATA_DIR" set "DATA_DIR=%%B"
)
set "DATA_DIR=%DATA_DIR: =%"

if "%DATA_DIR%"=="" (
    echo [HATA] .env icinde DATA_DIR tanimli degil.
    pause
    exit /b 1
)

echo [BILGI] Kalici veri klasoru: %DATA_DIR%
if not exist "%DATA_DIR%\mongodb" mkdir "%DATA_DIR%\mongodb"
if not exist "%DATA_DIR%\uploads" mkdir "%DATA_DIR%\uploads"
if not exist "%DATA_DIR%\backup"  mkdir "%DATA_DIR%\backup"

echo [BILGI] Docker Compose build + up (ilk seferde ~5-10 dk surer)...
docker compose up -d --build
if errorlevel 1 (
    echo [HATA] docker compose baslatma basarisiz.
    pause
    exit /b 1
)

echo.
echo [OK] Sistem baslatildi. Container durumu:
docker compose ps
echo.
echo [BILGI] Bu bilgisayarin LAN IP'si:
ipconfig | findstr /R /C:"IPv4"
echo.
echo Client bilgisayarlar tarayicidan asagidaki adrese baglanir:
echo   http://SERVER_IP
echo (SERVER_IP = yukaridaki IPv4 adresi)
pause
