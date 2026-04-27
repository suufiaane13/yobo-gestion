#requires -Version 5.1
<#
.SYNOPSIS
  Construit l’installateur Windows (release) et prépare un dossier prêt à livrer
  aux utilisateurs finaux : .exe + LISEZMOI-UTILISATEUR.txt.

.EXAMPLE
  .\scripts\build-user-release.ps1
  .\scripts\build-user-release.ps1 -OpenFolder
#>
param(
  [switch]$OpenFolder
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')

Set-Location $root

Write-Host '>>> npm run build' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '>>> Graphismes installeur NSIS (public/logo.png)' -ForegroundColor Cyan
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'generate-nsis-installer-assets.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '>>> npx tauri build' -ForegroundColor Cyan
npx tauri build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$cfg = Get-Content (Join-Path $root 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$ver = $cfg.version
$product = $cfg.productName
$exe = "${product}_${ver}_x64-setup.exe"
$nsisDir = Join-Path $root 'src-tauri\target\release\bundle\nsis'
$exePath = Join-Path $nsisDir $exe

if (-not (Test-Path -LiteralPath $exePath)) {
  Write-Error "Installateur introuvable : $exePath"
}

$outDir = Join-Path $root "distribution\YOBO-Gestion-v$ver"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Copy-Item -LiteralPath $exePath -Destination (Join-Path $outDir $exe) -Force

$readme = Join-Path $root 'distribution\LISEZMOI-UTILISATEUR.txt'
if (Test-Path -LiteralPath $readme) {
  Copy-Item -LiteralPath $readme -Destination (Join-Path $outDir 'LISEZMOI-UTILISATEUR.txt') -Force
}

Write-Host ''
Write-Host "Livrable utilisateur : $outDir" -ForegroundColor Green
Write-Host "  - $exe"
Write-Host '  - LISEZMOI-UTILISATEUR.txt'

if ($OpenFolder) {
  Start-Process explorer.exe $outDir
}
