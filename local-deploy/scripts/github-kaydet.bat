@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
echo ============================================================
echo   Degisiklikler GitHub'a kaydediliyor...
echo ============================================================
git status --short
echo.
git add -A
git commit -m "Raporlara Departman sutunu, izin export guncelleme duzeltmesi, bekleyen yerel degisiklikler"
if errorlevel 1 (
  echo.
  echo [BILGI] Kaydedilecek yeni degisiklik yok ya da commit yapilamadi.
)
echo.
git push origin main
if errorlevel 1 (
  echo.
  echo [HATA] GitHub'a gonderilemedi. Bu pencerenin ekran goruntusunu gonderin.
) else (
  echo.
  echo [OK] GitHub'a kaydedildi.
)
echo.
git status --short
pause
