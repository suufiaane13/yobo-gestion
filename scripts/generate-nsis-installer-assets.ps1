# Génère les BMP (header + bandeau) pour l’installeur NSIS à partir de public/logo.png.
# Couleurs alignées sur :root (thème sombre YOBO).
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$logoPath = Join-Path $RepoRoot 'public\logo.png'
if (-not (Test-Path -LiteralPath $logoPath)) {
  throw "Fichier introuvable : $logoPath"
}

$outDir = Join-Path $RepoRoot 'src-tauri\bundle\nsis'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$headerOut = Join-Path $outDir 'installer-header.bmp'
$sidebarOut = Join-Path $outDir 'installer-sidebar.bmp'

Add-Type -AssemblyName System.Drawing

function Get-YoboGraphics {
  param([System.Drawing.Bitmap]$Bmp)
  $g = [System.Drawing.Graphics]::FromImage($Bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return $g
}

# --- Bandeau haut (150×57) : logo + filet accent ---
$hw = 150
$hh = 57
$hBmp = New-Object System.Drawing.Bitmap $hw, $hh
$hG = Get-YoboGraphics $hBmp
$bgTop = [System.Drawing.Color]::FromArgb(255, 28, 27, 27)
$hG.Clear($bgTop)

$accent = [System.Drawing.Color]::FromArgb(255, 240, 133, 10)
$hPen = New-Object System.Drawing.Pen $accent, 2
$hG.DrawLine($hPen, 0, $hh - 2, $hw, $hh - 2)

$logo = [System.Drawing.Image]::FromFile($logoPath)
try {
  $maxH = 44
  $scale = [math]::Min($maxH / $logo.Height, ($hw - 20) / $logo.Width)
  $lw = [int][math]::Round($logo.Width * $scale)
  $lh = [int][math]::Round($logo.Height * $scale)
  $hx = 8
  $hy = [int][math]::Round(($hh - $lh) / 2)
  $hG.DrawImage($logo, $hx, $hy, $lw, $lh)
} finally {
  $logo.Dispose()
}

$hG.Dispose()
$hBmp.Save($headerOut, [System.Drawing.Imaging.ImageFormat]::Bmp)
$hBmp.Dispose()

# --- Bandeau latéral accueil / fin (164×314) : dégradé + logo ---
$sw = 164
$sh = 314
$sBmp = New-Object System.Drawing.Bitmap $sw, $sh
$sG = Get-YoboGraphics $sBmp

$rect = New-Object System.Drawing.Rectangle 0, 0, $sw, $sh
$c1 = [System.Drawing.Color]::FromArgb(255, 19, 19, 19)
$c2 = [System.Drawing.Color]::FromArgb(255, 32, 30, 29)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $rect, $c1, $c2, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$sG.FillRectangle($grad, $rect)
$grad.Dispose()

# Halo discret accent (bas)
try {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse(-20, [int]($sh * 0.55), $sw + 40, [int]($sh * 0.55))
  $glowCol = [System.Drawing.Color]::FromArgb(38, 240, 133, 10)
  $glowBrush = New-Object System.Drawing.SolidBrush $glowCol
  $sG.FillPath($glowBrush, $path)
  $glowBrush.Dispose()
  $path.Dispose()
} catch {
  # ignore si path échoue sur vieux .NET
}

$logo2 = [System.Drawing.Image]::FromFile($logoPath)
try {
  $maxSide = 118
  $scale2 = [math]::Min($maxSide / $logo2.Height, ($sw - 24) / $logo2.Width)
  $lw2 = [int][math]::Round($logo2.Width * $scale2)
  $lh2 = [int][math]::Round($logo2.Height * $scale2)
  $sx = [int][math]::Round(($sw - $lw2) / 2)
  $sy = 36
  $sG.DrawImage($logo2, $sx, $sy, $lw2, $lh2)
} finally {
  $logo2.Dispose()
}

$font = [System.Drawing.Font]::new('Segoe UI', 8.25, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Point)
$muted = [System.Drawing.Color]::FromArgb(255, 219, 194, 176)
$txtBrush = New-Object System.Drawing.SolidBrush $muted
$accentBrush = New-Object System.Drawing.SolidBrush $accent
$sG.DrawString('YOBO', $font, $accentBrush, 12, [single]($sy + $lh2 + 14))
$subFont = [System.Drawing.Font]::new('Segoe UI', 7.5, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Point)
$sG.DrawString('Gestion snack', $subFont, $txtBrush, 12, [single]($sy + $lh2 + 32))

$font.Dispose()
$subFont.Dispose()
$txtBrush.Dispose()
$accentBrush.Dispose()

$sG.Dispose()
$sBmp.Save($sidebarOut, [System.Drawing.Imaging.ImageFormat]::Bmp)
$sBmp.Dispose()

Write-Host "OK : $headerOut"
Write-Host "OK : $sidebarOut"
