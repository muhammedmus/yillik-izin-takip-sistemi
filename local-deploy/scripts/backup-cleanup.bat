@echo off
setlocal

title Yillik Izin Takip Sistemi - Eski Yedek Temizleme

cd /d "%~dp0.."

echo.
echo ============================================================
echo   ESKI YEDEK TEMIZLEME
echo ============================================================
echo.

set "DATA_DIR="

for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /I "%%A"=="DATA_DIR" set "DATA_DIR=%%B"
)

set "DATA_DIR=%DATA_DIR: =%"
set "DATA_DIR=%DATA_DIR:/=\%"

if "%DATA_DIR%"=="" (
    echo [HATA] .env icinde DATA_DIR bulunamadi.
    pause
    exit /b 1
)

set "BACKUP_ROOT=%DATA_DIR%\backup"

if not exist "%BACKUP_ROOT%" (
    echo [HATA] Yedek klasoru bulunamadi:
    echo %BACKUP_ROOT%
    pause
    exit /b 1
)

echo Yedek klasoru:
echo %BACKUP_ROOT%
echo.
echo Kural:
echo - 30 gunden yeni yedekler KALIR
echo - 30 gunden eski tarihli yedek klasorleri SILINIR
echo - Sadece YYYY-MM-DD_HHMMSS formatindaki klasorler dikkate alinir
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$root='%BACKUP_ROOT%'; $limit=(Get-Date).AddDays(-30); $items=Get-ChildItem -LiteralPath $root -Directory | Where-Object { $_.Name -match '^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}$' -and $_.LastWriteTime -lt $limit }; if($items.Count -eq 0){ Write-Host '[OK] Silinecek eski yedek bulunamadi.'; exit 0 }; foreach($item in $items){ Write-Host '[SILINIYOR]' $item.FullName; Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop }; Write-Host '[OK] Eski yedek temizligi tamamlandi.'"

if errorlevel 1 (
    echo.
    echo [HATA] Eski yedek temizleme islemi basarisiz.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   TEMIZLIK TAMAMLANDI
echo ============================================================
echo.

pause
endlocal