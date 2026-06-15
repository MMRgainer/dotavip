@echo off
REM ── DotaVIP dev launcher (one click) ─────────────────────────────
title DotaVIP launcher

REM stop old instances
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM dotavip-backend.exe >nul 2>&1

REM 1) backend
cd /d "C:\Projects\DotaVIP\backend"
start "DotaVIP backend" /min ".venv\Scripts\python.exe" -m uvicorn api.server:app --host 127.0.0.1 --port 8765 --log-level warning

REM 2) frontend dev server
cd /d "C:\Projects\DotaVIP\frontend"
start "DotaVIP vite" /min cmd /c "node_modules\.bin\vite.cmd --port 5173"

REM wait for vite
timeout /t 6 /nobreak >nul

REM 3) overlay window
set NODE_ENV=development
start "" "node_modules\electron\dist\electron.exe" .

echo DotaVIP started. You can close this window.
timeout /t 3 >nul
