# Start Dota 2 Overlay Backend — GSI listener

$projectDir = "C:\Projects\DotaVIP\backend"

Write-Host "🔧 Starting Dota 2 Overlay Backend..." -ForegroundColor Green
Write-Host ""

Push-Location $projectDir

# Verify .venv exists
if (-not (Test-Path ".\.venv")) {
  Write-Host "❌ Virtual environment not found. Run: python -m venv .venv" -ForegroundColor Red
  exit 1
}

# Activate venv and start backend
Write-Host "🚀 Starting GSI listener (port 8765)..." -ForegroundColor Cyan
Write-Host "Waiting for Dota 2 GSI connections..." -ForegroundColor Yellow
Write-Host ""

$env:PYTHONUNBUFFERED = "1"
&".\.venv\Scripts\python.exe" -m uvicorn api.server:app --host 127.0.0.1 --port 8765 --log-level warning --workers 1

Pop-Location
