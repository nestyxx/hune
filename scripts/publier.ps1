<#
.SYNOPSIS
  Construit, signe et publie une version de Hune sur GitHub (installeurs + latest.json lu par la mise à jour automatique).

.DESCRIPTION
  La clé de signature reste sur ce poste (~\.tauri\hune.key) : elle n'est jamais envoyée à GitHub.
  Prérequis : gh authentifié (gh auth status), arbre git propre, version déjà incrémentée dans package.json,
  src-tauri/Cargo.toml et src-tauri/tauri.conf.json.

.EXAMPLE
  powershell -File scripts/publier.ps1 -Notes "Correctif du portefeuille"
#>
param(
  [string]$Notes = "Voir l'historique des commits.",
  [string]$Depot = "nestyxx/hune"
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
$latest | ConvertTo-Json -Depth 5 | Set-Content -Path $fichierLatest -Encoding utf8

git tag $tag
git push origin $tag
gh release create $tag $setup.FullName "$($setup.FullName).sig" $msi.FullName $fichierLatest --repo $Depot --title "Hune $tag" --notes $Notes
Write-Host "Version $tag publiée : https://github.com/$Depot/releases/tag/$tag"
