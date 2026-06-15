# Build the full DotaVIP one-click installer.
# Output: frontend/release/DotaVIP-Setup-<version>.exe
#
# To build AND publish to GitHub Releases (for auto-update):
#   $env:GH_TOKEN = "ghp_..."   (your GitHub Personal Access Token, repo scope)
#   .\build_installer.ps1 -Publish
# Without -Publish: builds locally only (no upload).
param([switch]$Publish)
$ErrorActionPreference = "Stop"
$root = "C:\Projects\DotaVIP"

Write-Host "=== [1/4] Building Python backend (PyInstaller) ===" -ForegroundColor Cyan
Set-Location "$root\backend"
& ".\.venv\Scripts\python.exe" -m PyInstaller dotavip-backend.spec --noconfirm --distpath dist_backend --workpath build_backend
if (-not (Test-Path "$root\backend\dist_backend\dotavip-backend.exe")) { throw "backend build failed" }

Write-Host "=== [2/4] Bundling Tesseract (eng only) ===" -ForegroundColor Cyan
$tessSrc = "C:\Program Files\Tesseract-OCR"
$tessDst = "$root\backend\tesseract_bundle"
if (Test-Path $tessSrc) {
    Remove-Item $tessDst -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force "$tessDst\tessdata" | Out-Null
    Copy-Item "$tessSrc\tesseract.exe" $tessDst -Force
    Copy-Item "$tessSrc\*.dll" $tessDst -Force -ErrorAction SilentlyContinue
    Copy-Item "$tessSrc\tessdata\eng.traineddata" "$tessDst\tessdata\" -Force
    $mb = [int]((Get-ChildItem $tessDst -Recurse | Measure-Object Length -Sum).Sum/1MB)
    Write-Host ("  Tesseract bundled: " + $mb + " MB")
} else {
    Write-Host "  WARNING: Tesseract not found - OCR will not work" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force $tessDst | Out-Null
}

Write-Host "=== [3/4] Building frontend (Vite) ===" -ForegroundColor Cyan
Set-Location "$root\frontend"
& npm run build

Write-Host "=== [3.5/4] Preparing winCodeSign cache (no-admin symlink fix) ===" -ForegroundColor Cyan
# electron-builder fails to extract winCodeSign (macOS dylib symlinks need a
# privilege Windows withholds without Developer Mode). Pre-create the cache
# folder from the Windows tools so electron-builder skips its own extraction.
$wcs = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
$wcsFinal = "$wcs\winCodeSign-2.6.0"
if (-not (Test-Path "$wcsFinal\windows-10")) {
    New-Item -ItemType Directory -Force $wcs | Out-Null
    $z = "$root\frontend\node_modules\7zip-bin\win\x64\7za.exe"
    $url = "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z"
    $arc = "$wcs\winCodeSign-2.6.0.7z"
    if (-not (Test-Path $arc)) { Invoke-WebRequest $url -OutFile $arc -UseBasicParsing }
    $tmp = "$wcs\_extract_tmp"
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    # Temporarily allow non-terminating errors so 7za symlink warnings don't stop the script
    $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    & $z x -snld -bd $arc "-o$tmp" -y | Out-Null
    $ErrorActionPreference = $prev
    Remove-Item "$tmp\darwin" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $wcsFinal -Recurse -Force -ErrorAction SilentlyContinue
    Move-Item $tmp $wcsFinal -Force
    Write-Host "  winCodeSign cache prepared"
} else {
    Write-Host "  winCodeSign cache already present"
}

Write-Host "=== [4/4] Packaging installer (electron-builder) ===" -ForegroundColor Cyan
Set-Location "$root\frontend"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
if ($Publish) {
    if (-not $env:GH_TOKEN) { throw "Set `$env:GH_TOKEN before publishing" }
    Write-Host "  Publishing to GitHub Releases..." -ForegroundColor Yellow
    & npx electron-builder --win nsis --publish always
    # Publish all draft releases created by electron-builder
    $headers = @{Authorization="token $env:GH_TOKEN"; "Content-Type"="application/json"}
    $releases = Invoke-RestMethod "https://api.github.com/repos/DanyloIT/dotavip/releases" -Headers $headers
    foreach ($rel in ($releases | Where-Object { $_.draft -eq $true })) {
        Invoke-RestMethod "https://api.github.com/repos/DanyloIT/dotavip/releases/$($rel.id)" -Method Patch -Headers $headers -Body '{"draft":false,"make_latest":"true"}' | Out-Null
        Write-Host "  Released: $($rel.tag_name)" -ForegroundColor Green
    }
} else {
    & npx electron-builder --win nsis --publish never
}

Write-Host ""
Write-Host "DONE. Installer in frontend\release\" -ForegroundColor Green
Get-ChildItem "$root\frontend\release\*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host ("  " + $_.Name + "  " + [int]($_.Length/1MB) + " MB")
}
