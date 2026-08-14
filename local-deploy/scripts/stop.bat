@echo off
REM ============================================================================
REM Merkoteks Personel Sistemi - LOCAL STOP (graceful)
REM ============================================================================
cd /d "%~dp0.."
echo [BILGI] Sistem duzgunce durduruluyor...
docker compose stop
echo.
echo [OK] Durduruldu. Verileriniz %DATA_DIR% altinda korunuyor.
echo Yeniden baslatmak icin start.bat calistirin.
pause
