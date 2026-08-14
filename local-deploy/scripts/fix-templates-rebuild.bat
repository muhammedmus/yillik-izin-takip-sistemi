@echo off
REM ============================================================================
REM Merkoteks - TEMPLATE FIX FORCE REBUILD (Windows)
REM Bu betik: 1) git pull  2) full no-cache rebuild  3) template doğrula
REM ============================================================================
setlocal
cd /d "%~dp0.."

echo === 1/6: Git güncellemesi ===
git fetch origin
git checkout main
git pull origin main
echo.
echo Son commit:
git log --oneline -1
echo.

echo === 2/6: Dockerfile'da template COPY var mı? ===
findstr /C:"COPY backend/templates" local-deploy\backend\Dockerfile
if errorlevel 1 (
    echo [HATA] Dockerfile'da template COPY satiri YOK! Git pull eksik olabilir.
    pause
    exit /b 1
)
echo   OK - template COPY satiri var
echo.

echo === 3/6: Repository'de template dosyasi var mi? ===
if not exist "..\backend\templates\izin_template.xlsm" (
    echo [HATA] backend/templates/izin_template.xlsm bulunamadi
    pause
    exit /b 1
)
dir ..\backend\templates
echo.

echo === 4/6: Docker container ve image'i tamamen sil ===
docker compose down
docker rmi -f local-deploy-backend merkoteks-backend 2>NUL
docker builder prune -f
echo.

echo === 5/6: NO-CACHE tam yeniden build ===
docker compose build --no-cache backend
if errorlevel 1 (
    echo [HATA] Backend build basarisiz. Yukarida hata mesaji vardir.
    pause
    exit /b 1
)
echo.

echo === 6/6: Container icinde template DOGRULAMA ===
docker compose up -d
timeout /t 8 /nobreak >NUL
echo.
echo -- ls /app/templates --
docker exec merkoteks-backend ls -lah /app/templates
echo.
echo -- test -f izin_template.xlsm --
docker exec merkoteks-backend test -f /app/templates/izin_template.xlsm && echo TEMPLATE OK || echo TEMPLATE MISSING
echo.
echo -- openpyxl load prova --
docker exec merkoteks-backend python -c "from openpyxl import load_workbook; wb=load_workbook('/app/templates/izin_template.xlsm', keep_vba=True); print('Sheets:', wb.sheetnames)"
echo.
echo === TAMAMLANDI ===
pause
