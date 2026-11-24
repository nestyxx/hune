<#
.SYNOPSIS
  Construit, signe et publie une version de Hune sur GitHub (installeurs + latest.json lu par la mise à jour automatique).

.DESCRIPTION
  La clé de signature reste sur ce poste (~\.tauri\hune.key) : elle n'est jamais envoyée à GitHub.
  Prérequis : gh authentifié (gh auth status), arbre git propre, version déjà incrémentée dans package.json,
  src-tauri/Cargo.toml et src-tauri/tauri.conf.json.

  Garde-fous : une section [version] doit exister dans CHANGELOG.md (son texte devient les notes de la release) et
  les captures du README (docs/captures) ne doivent pas être plus anciennes que le dernier changement de l'interface
  (npm run captures, ou -IgnorerCaptures pour un correctif sans effet visible).

.EXAMPLE
  powershell -File scripts/publier.ps1
#>
param(
  [string]$Notes = "",
  [string]$Depot = "nestyxx/hune",
  [switch]$IgnorerCaptures
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$conf = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json
$version = $conf.version
$tag = "v$version"
$cle = Join-Path $HOME ".tauri/hune.key"
$mdp = Join-Path $HOME ".tauri/hune.key.password"
if (-not (Test-Path $cle)) { throw "Clé de signature introuvable : $cle" }

# Cohérence des numéros de version et propreté du dépôt.
$pkg = (Get-Content package.json -Raw | ConvertFrom-Json).version
$cargo = (Select-String -Path src-tauri/Cargo.toml -Pattern '^version = "(.+)"').Matches[0].Groups[1].Value
if ($pkg -ne $version -or $cargo -ne $version) { throw "Versions incohérentes : tauri.conf=$version, package.json=$pkg, Cargo.toml=$cargo" }
if (git status --porcelain) { throw "Des modifications ne sont pas commitées : commitez avant de publier." }
if (git tag --list $tag) { throw "Le tag $tag existe déjà : incrémentez la version." }

# Notes de version : la section du CHANGELOG correspondant à cette version est obligatoire.
$changelog = Get-Content CHANGELOG.md -Raw -Encoding UTF8
$section = [regex]::Match($changelog, "(?ms)^## \[$([regex]::Escape($version))\][^\r\n]*\r?\n(.*?)(?=^## \[|\z)")
if (-not $section.Success -or -not $section.Groups[1].Value.Trim()) { throw "CHANGELOG.md n'a pas de section [$version] : décrivez les changements avant de publier." }
if (-not $Notes) { $Notes = $section.Groups[1].Value.Trim() }

# Captures du README : doivent avoir été régénérées depuis le dernier changement de l'interface.
if (-not $IgnorerCaptures) {
  $dernierSrc = [long](git log -1 --format=%ct -- src branding)
  $dernieresCaptures = [long](git log -1 --format=%ct -- docs/captures)
  if ($dernieresCaptures -eq 0) { throw "Aucune capture dans docs/captures : lancez npm run captures et commitez-les." }
  if ($dernierSrc -gt $dernieresCaptures) { throw "L'interface a changé depuis les dernières captures : lancez npm run captures, relisez les images, commitez (ou -IgnorerCaptures)." }
}

npx tsc; if ($LASTEXITCODE) { throw "tsc a échoué" }
npm test; if ($LASTEXITCODE) { throw "Les tests ont échoué" }

$env:TAURI_SIGNING_PRIVATE_KEY = $cle
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content $mdp -Raw).Trim()
npm run tauri build; if ($LASTEXITCODE) { throw "Le build a échoué" }

$nsis = "src-tauri/target/release/bundle/nsis"
$setup = Get-Item "$nsis/Hune_${version}_x64-setup.exe"
$sig = (Get-Content "$setup.sig" -Raw).Trim()
$msi = Get-Item "src-tauri/target/release/bundle/msi/Hune_${version}_x64_en-US.msi"

# Fichier lu par l'application pour savoir qu'une nouvelle version existe.
$latest = [ordered]@{
  version  = $version
  notes    = $Notes
  pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $sig
      url       = "https://github.com/$Depot/releases/download/$tag/$($setup.Name)"
    }
  }
}
$fichierLatest = Join-Path $env:TEMP "latest.json"
# UTF-8 SANS BOM : Set-Content -Encoding utf8 (PowerShell 5.1) en ajoute un, et l'analyseur JSON de l'application le refuse.
$utf8SansBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($fichierLatest, ($latest | ConvertTo-Json -Depth 5), $utf8SansBom)

git tag $tag
git push origin $tag
$fichierNotes = Join-Path $env:TEMP "notes-$tag.md"
[System.IO.File]::WriteAllText($fichierNotes, $Notes, $utf8SansBom)
gh release create $tag $setup.FullName "$($setup.FullName).sig" $msi.FullName $fichierLatest --repo $Depot --title "Hune $tag" --notes-file $fichierNotes
Write-Host "Version $tag publiée : https://github.com/$Depot/releases/tag/$tag"
