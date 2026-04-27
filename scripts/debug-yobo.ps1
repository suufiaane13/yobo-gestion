#requires -Version 5.1
<#
.SYNOPSIS
  YOBO Gestion — lance debug-yobo.mjs avec contexte PowerShell (versions, env, transcription).

.DESCRIPTION
  Affiche un résumé lisible (OS, chemins, outils, variables Rust/WebView2) puis exécute le script Node.
  Utilise -Full pour un audit étendu (npm ls, git, build Vite). -Transcript enregistre toute la session PS dans logs\.

.EXAMPLE
  .\scripts\debug-yobo.ps1
  Audit TypeScript + ESLint + Rust (rapport dans logs\).

.EXAMPLE
  .\scripts\debug-yobo.ps1 -Full -OpenLog
  Audit complet + ouverture du dernier rapport dans le Bloc-notes.

.EXAMPLE
  .\scripts\debug-yobo.ps1 -All -Full -Transcript
  Audit full puis tauri dev ; tout est aussi dans logs\ps-transcript-*.txt

.EXAMPLE
  .\scripts\debug-yobo.ps1 -Dev
  tauri dev (RUST_LOG=debug, port WebView2 9222 sur Windows).
#>
param(
  [switch]$Dev,
  [switch]$All,
  [switch]$Doctor,
  # Audit / doctor étendus : npm ls, git, build Vite (voir debug-yobo.mjs).
  [switch]$Full,
  # Transcription complète de la session PS → logs\ps-transcript-<horodatage>.txt
  [switch]$Transcript,
  # Après audit / doctor / all : ouvre le dernier rapport dans le Bloc-notes
  [switch]$OpenLog,
  [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
if ($Verbose) { $VerbosePreference = 'Continue' }

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$arg = if ($Dev) { 'dev' } elseif ($All) { 'all' } elseif ($Doctor) { 'doctor' } else { 'audit' }
$nodeScript = Join-Path $root 'scripts\debug-yobo.mjs'
$nodeArgs = [System.Collections.Generic.List[string]]::new()
$nodeArgs.Add($arg)
if ($Full) { $nodeArgs.Add('--full') }

function Write-YoboBannerLine([string]$Text, [string]$Color = 'Cyan') {
  Write-Host $Text -ForegroundColor $Color
}

function Show-YoboPreamble {
  $sep = ('=' * 76)
  Write-Host ""
  Write-YoboBannerLine $sep
  $modeSuffix = if ($Full) { ' + FULL' } else { '' }
  Write-YoboBannerLine ('  YOBO Gestion - debug-yobo.ps1  |  mode=' + $arg + $modeSuffix)
  Write-YoboBannerLine $sep
  Write-Host "  Racine projet : " -NoNewline -ForegroundColor DarkGray
  Write-Host $root -ForegroundColor White
  Write-Host "  Script Node   : " -NoNewline -ForegroundColor DarkGray
  Write-Host $nodeScript -ForegroundColor White
  Write-Host "  Heure locale  : " -NoNewline -ForegroundColor DarkGray
  Write-Host (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -ForegroundColor White
  Write-Host "  PowerShell    : " -NoNewline -ForegroundColor DarkGray
  Write-Host $PSVersionTable.PSVersion.ToString() -ForegroundColor White
  Write-Host "  OS            : " -NoNewline -ForegroundColor DarkGray
  Write-Host ([System.Environment]::OSVersion.VersionString) -ForegroundColor White
  Write-Host ""

  $tools = @(
    @{ Name = 'node'; Args = @('--version') },
    @{ Name = 'npm'; Args = @('--version') }
  )
  foreach ($t in $tools) {
    $cmd = Get-Command $t.Name -ErrorAction SilentlyContinue
    if ($cmd) {
      try {
        $ver = & $t.Name @($t.Args) 2>$null
        Write-Host ("  {0,-6} -> " -f $t.Name) -NoNewline -ForegroundColor DarkGray
        Write-Host (($ver | Out-String).Trim()) -NoNewline -ForegroundColor Green
        Write-Host ("  ({0})" -f $cmd.Source) -ForegroundColor DarkGray
      }
      catch {
        Write-Host ("  {0,-6} -> (erreur lors de l'appel)" -f $t.Name) -ForegroundColor Yellow
      }
    }
    else {
      Write-Host ("  {0,-6} -> non trouve dans le PATH" -f $t.Name) -ForegroundColor Yellow
    }
  }

  foreach ($rustBin in @('rustc', 'cargo')) {
    $cmd = Get-Command $rustBin -ErrorAction SilentlyContinue
    if ($cmd) {
      try {
        $ver = & $rustBin @('--version') 2>$null
        Write-Host ("  {0,-6} -> " -f $rustBin) -NoNewline -ForegroundColor DarkGray
        Write-Host (($ver | Out-String).Trim()) -NoNewline -ForegroundColor Green
        Write-Host ("  ({0})" -f $cmd.Source) -ForegroundColor DarkGray
      }
      catch {
        Write-Host ("  {0,-6} -> (erreur)" -f $rustBin) -ForegroundColor Yellow
      }
    }
    else {
      Write-Host ("  {0,-6} -> non trouve (optionnel hors Tauri)" -f $rustBin) -ForegroundColor DarkGray
    }
  }

  Write-Host ""
  Write-YoboBannerLine '  Variables d''environnement (debug Tauri / Rust)' 'DarkCyan'
  $envKeys = @(
    'RUST_LOG',
    'RUST_BACKTRACE',
    'TAURI_ENV_DEBUG',
    'WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS',
    'NODE_OPTIONS',
    'YOBO_DEBUG_FULL'
  )
  foreach ($k in $envKeys) {
    $v = [System.Environment]::GetEnvironmentVariable($k)
    if ($null -ne $v -and $v -ne '') {
      $display = if ($v.Length -gt 120) { $v.Substring(0, 117) + '...' } else { $v }
      Write-Host ("  {0,-42} = " -f $k) -NoNewline -ForegroundColor DarkGray
      Write-Host $display -ForegroundColor White
    }
    else {
      Write-Host ("  {0,-42} (non définie, défauts dans mjs au lancement dev)" -f $k) -ForegroundColor DarkGray
    }
  }

  Write-Host ""
  Write-YoboBannerLine '  PATH (5 premiers segments)' 'DarkCyan'
  $pathParts = $env:PATH -split [regex]::Escape([IO.Path]::PathSeparator) | Where-Object { $_ }
  $pathParts | Select-Object -First 5 | ForEach-Object {
    Write-Host "    $_" -ForegroundColor DarkGray
  }
  if (($pathParts | Measure-Object).Count -gt 5) {
    $n = ($pathParts | Measure-Object).Count
    Write-Host ('    ... ({0} entrees PATH au total)' -f $n) -ForegroundColor DarkGray
  }

  Write-Host ""
  Write-YoboBannerLine $sep
  Write-Host ""
}

$transcriptPath = $null
if ($Transcript) {
  $logsDir = Join-Path $root 'logs'
  if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }
  $tsName = 'ps-transcript-{0:yyyyMMdd-HHmmss}.txt' -f (Get-Date)
  $transcriptPath = Join-Path $logsDir $tsName
  Start-Transcript -Path $transcriptPath -Force | Out-Null
  Write-Host ('Transcript: {0}' -f $transcriptPath) -ForegroundColor Magenta
  Write-Host ""
}

$exitCode = 0
try {
  Show-YoboPreamble
  Write-Verbose "Execution: node $nodeScript $($nodeArgs -join ' ')"
  & node $nodeScript @nodeArgs
  if ($null -ne $LASTEXITCODE) { $exitCode = $LASTEXITCODE }
}
finally {
  if ($transcriptPath) {
    try { Stop-Transcript | Out-Null } catch { }
    Write-Host ""
    Write-Host ('Transcript termine: {0}' -f $transcriptPath) -ForegroundColor Magenta
  }
}

if ($OpenLog -and $arg -ne 'dev') {
  $pattern = if ($Doctor) { 'yobo-doctor-*.log' } else { 'yobo-debug-*.log' }
  $logsDir = Join-Path $root 'logs'
  $latest = Get-ChildItem -Path $logsDir -Filter $pattern -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($latest) {
    Write-Host ""
    Write-Host ('OpenLog: {0}' -f $latest.FullName) -ForegroundColor Green
    Start-Process notepad.exe -ArgumentList $latest.FullName
  }
  else {
    Write-Host ('OpenLog: aucun fichier {0} dans {1}' -f $pattern, $logsDir) -ForegroundColor Yellow
  }
}

exit $exitCode
