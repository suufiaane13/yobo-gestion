#requires -Version 5.1
# Alias pratique : même effet que `npm run build:tauri` / `npx tauri build` (sans signature ni mises à jour).
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root
npx tauri build
exit $LASTEXITCODE
