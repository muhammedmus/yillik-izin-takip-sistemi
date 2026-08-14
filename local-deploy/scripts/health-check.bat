@echo off
REM ============================================================================
REM Merkoteks - HEALTH CHECK
REM ============================================================================
cd /d "%~dp0.."
echo === Container durumu ===
docker compose ps
echo.
echo === Health kontrolleri ===
for %%S in (mongodb backend nginx) do (
    echo -- merkoteks-%%S --
    docker inspect --format="Status: {{.State.Status}} | Health: {{.State.Health.Status}}" merkoteks-%%S 2>NUL
)
echo.
echo === Backend /api/ ping ===
curl -s -o NUL -w "HTTP:%%{http_code}  time:%%{time_total}s\n" http://localhost/api/
echo.
echo === Frontend / ping ===
curl -s -o NUL -w "HTTP:%%{http_code}  time:%%{time_total}s\n" http://localhost/
echo.
echo === LibreOffice binary check ===
docker exec merkoteks-backend which libreoffice
docker exec merkoteks-backend libreoffice --version
pause
