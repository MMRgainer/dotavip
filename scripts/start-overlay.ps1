# Start Dota Overlay — production optimized

$projectDir = "C:\Projects\DotaVIP\frontend"

Write-Host "🚀 Starting Dota 2 Overlay..." -ForegroundColor Green
Write-Host ""

# Kill old processes
Write-Host "⏹️  Cleaning up old processes..." -ForegroundColor Yellow
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "vite" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1

# Start Vite dev server
Write-Host "🔥 Starting Vite dev server (port 5173)..." -ForegroundColor Cyan
Push-Location $projectDir
Start-Process "cmd" -ArgumentList "/c node_modules\.bin\vite.cmd --port 5173" -NoNewWindow
Start-Sleep 5

# Verify Vite is ready
$viteFails = 0
while ($viteFails -lt 3) {
  try {
    $r = Invoke-WebRequest "http://localhost:5173" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Vite ready" -ForegroundColor Green
    break
  }
  catch {
    $viteFails++
    if ($viteFails -lt 3) { Start-Sleep 2 }
  }
}

if ($viteFails -ge 3) {
  Write-Host "✗ Vite failed to start" -ForegroundColor Red
  exit 1
}

# Start Electron overlay
Write-Host "🎮 Starting Electron overlay..." -ForegroundColor Cyan
$env:NODE_ENV = "development"
Start-Process "node_modules\electron\dist\electron.exe" -ArgumentList "." -WorkingDirectory $projectDir

Pop-Location

Write-Host ""
Write-Host "✅ Overlay started!" -ForegroundColor Green
Write-Host "⏳ Loading... (first run takes ~5 seconds for C# compilation)" -ForegroundColor Yellow
Write-Host ""
Write-Host "When you alt+tab to Dota 2, the overlay should appear instantly"
Write-Host "When you alt+tab away from Dota, it will hide automatically"
Write-Host ""
