<#
.SYNOPSIS
  Dessine les images de l'installeur Windows (NSIS) à partir du logo : bandeau 150x57 et panneau latéral 164x314.

.DESCRIPTION
  Écrit src-tauri/nsis/header.bmp et sidebar.bmp (BMP 24 bits, format imposé par NSIS), référencés dans
  src-tauri/tauri.conf.json (bundle.windows.nsis). À relancer si le logo ou la charte change :
    powershell -File scripts/images-installeur.ps1
  Option -Apercu : écrit aussi des PNG pour les relire.
#>
param([string]$Apercu = "")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Set-Location (Split-Path $PSScriptRoot -Parent)
$dossier = "src-tauri/nsis"
New-Item -ItemType Directory -Force $dossier | Out-Null

function Couleur([string]$hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }

# Rectangle aux coins arrondis (rayon r) : GDI+ n'en fournit pas de natif.
function Chemin-Arrondi([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $d = [Math]::Min($r * 2, [Math]::Min($w, $h))
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); return $p
}

# Logo : mêmes formes que branding/icone.svg (repère 1024 x 1024), à l'échelle voulue.
function Dessiner-Logo($g, [single]$x, [single]$y, [single]$taille) {
  $s = $taille / 1024
  $bleu = New-Object System.Drawing.SolidBrush (Couleur "#4f7fe0")
  $corail = New-Object System.Drawing.SolidBrush (Couleur "#ff9f80")
  $fond = New-Object System.Drawing.SolidBrush (Couleur "#cfe2ff")
  $g.FillPath($fond, (Chemin-Arrondi $x $y $taille $taille (232 * $s)))
  # (x, y, largeur, hauteur, rayon, couleur) : mèche puis corps de chaque bougie
  $formes = @(
    @(258, 530, 44, 270, 22, $bleu), @(195, 590, 170, 150, 44, $bleu),
    @(490, 350, 44, 350, 22, $bleu), @(427, 410, 170, 200, 44, $bleu),
    @(722, 190, 44, 370, 22, $corail), @(659, 250, 170, 230, 44, $corail))
  foreach ($f in $formes) { $g.FillPath($f[5], (Chemin-Arrondi ($x + $f[0] * $s) ($y + $f[1] * $s) ($f[2] * $s) ($f[3] * $s) ($f[4] * $s))) }
}

function Nouvelle-Image([int]$l, [int]$h) {
  $b = New-Object System.Drawing.Bitmap($l, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.SmoothingMode = "AntiAlias"; $g.TextRenderingHint = "AntiAliasGridFit"; $g.InterpolationMode = "HighQualityBicubic"
  return @($b, $g)
}

function Enregistrer($b, [string]$nom) {
  $b.Save((Join-Path (Get-Location) "$dossier/$nom.bmp"), [System.Drawing.Imaging.ImageFormat]::Bmp)
  if ($Apercu) { $b.Save((Join-Path $Apercu "$nom.png"), [System.Drawing.Imaging.ImageFormat]::Png) }
}

# --- Panneau latéral : dégradé bleu ciel, logo, nom et accroche ---
$b, $g = Nouvelle-Image 164 314
$degrade = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle 0, 0, 164, 314), (Couleur "#f6f9ff"), (Couleur "#e0ebff"), 90)
$g.FillRectangle($degrade, 0, 0, 164, 314)
Dessiner-Logo $g 34 70 96
$texte = New-Object System.Drawing.SolidBrush (Couleur "#182132")
$doux = New-Object System.Drawing.SolidBrush (Couleur "#4a5a78")
$centre = New-Object System.Drawing.StringFormat; $centre.Alignment = "Center"
$serif = New-Object System.Drawing.Font("Georgia", 26, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$sans = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString("Hune", $serif, $texte, (New-Object System.Drawing.RectangleF 0, 178, 164, 40), $centre)
$g.DrawString("Cryptos et actions,`nen lecture seule.", $sans, $doux, (New-Object System.Drawing.RectangleF 0, 222, 164, 44), $centre)
$g.Dispose(); Enregistrer $b "sidebar"

# --- Bandeau : fond blanc, logo à droite (l'assistant écrit le titre à gauche) ---
$b, $g = Nouvelle-Image 150 57
$g.Clear((Couleur "#ffffff"))
Dessiner-Logo $g 96 8 41
$g.Dispose(); Enregistrer $b "header"

Write-Host "Images écrites dans $dossier (header.bmp 150x57, sidebar.bmp 164x314)."
