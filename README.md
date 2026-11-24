# Hune

Application de bureau Windows (usage personnel, **lecture seule**) pour suivre cryptos et actions : graphiques en chandeliers avec indicateurs, alertes de prix et sur indicateurs avec notifications Windows, portefeuille valorisé en euros, carte du marché. Aucun compte, aucune clé API, aucun serveur : tout reste sur le poste.

> *La hune : plateforme en haut du mât d'un navire, d'où l'on guette l'horizon.*

Stack : Tauri 2 (Rust) + React 19 + TypeScript + Vite + Tailwind 4.

## Fonctions

- **Watchlist** : recherche par **symbole, nom ou ISIN** (clé de contrôle vérifiée avant l'appel), **catégories** personnalisables, tri, pastille 🔔 du nombre d'alertes armées par actif. Taper un nom propose d'abord les actifs déjà suivis.
- **Graphique** (Lightweight Charts) : 15 min / 1 h / 4 h / 1 j ; Bougies, Heikin-Ashi, Ligne, Aire ; Volume, SMA, EMA, Bollinger, RSI, MACD, Stochastique, tous **paramétrables** (⚙) ; légende OHLC, échelle logarithmique, recentrage (bouton, touche R ou double-clic).
- **Alertes** : prix, variation en % sur 1 h / 4 h / 24 h, RSI, cours qui franchit une SMA/EMA, croisement MACD/signal, croisement de moyennes (golden / death cross). Une alerte se déclenche **une fois**, passe à « déclenchée » et se réarme d'un bouton. Elles sont **dessinées sur le graphique**, et un **clic droit** sur le graphique crée une alerte de prix à ce niveau.
- **Portefeuille** : positions par lots (quantité, PAMP, objectif, plateforme), valeur en euros (conversion des devises), P&L latent, poids, distance à l'objectif, répartition par catégorie et par plateforme, création d'alertes aux objectifs.
- **Marché** : carte thermique par catégorie, plus fortes hausses/baisses, indice crypto Fear & Greed.
- **Zone de notification** : fermer la fenêtre ne quitte pas l'application, qui continue de vérifier les alertes (30, 45 ou 60 s). Clic gauche = ouvrir ; clic droit › Quitter. Option « Démarrer avec Windows ».
- **Thème** clair, sombre ou automatique ; **raccourcis** (Ctrl+K recherche, ↑/↓ actif, 1-4 intervalle, R recentrer, G/F/M/A/P onglets).
- **Sauvegarde** : export / import JSON (fusion ou remplacement).
- **Mises à jour automatiques** : vérification au démarrage puis toutes les 6 h ; paquets signés, installation sur clic.

## Prérequis

- Node 22+ et npm
- Rust stable (édition 2024) et les outils C++ de Visual Studio 2022 (ou Build Tools)
- WebView2 (présent sur Windows 11)

## Développement

```powershell
npm install
npm run dev        # ouvre la fenêtre Tauri (premier lancement : compilation Rust de quelques minutes)
npm test           # tests unitaires (indicateurs, alertes, portefeuille, cache/backoff, import…)
npm run web        # interface seule dans un navigateur (http://localhost:1421) : Binance marche, pas Yahoo
```

## Build local

La mise à jour automatique exige que les paquets soient signés : fournir la clé de signature (générée avec `npx tauri signer generate`, hors du dépôt).

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$HOME\.tauri\hune.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content "$HOME\.tauri\hune.key.password")
npm run tauri build
```

Produit dans `src-tauri/target/release/` : `hune.exe` et, dans `bundle/`, l'installeur NSIS (par utilisateur, sans droits admin) et un MSI.

## Publier une version

1. Mettre le même numéro dans `package.json`, `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json`.
2. `git tag vX.Y.Z && git push --tags` : le workflow `release.yml` construit, signe et publie la release GitHub avec `latest.json`, que les applications installées interrogent.

Secrets GitHub requis : `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. **Ne perdez pas la clé** : sans elle, les applications déjà installées ne pourront plus se mettre à jour.

## Structure

```
src/
  donnees/        sources : fournisseur.ts (interface DataProvider), binance.ts, yahoo.ts, requeteur.ts (cache + backoff),
                  change.ts (devises), isin.ts, sentiment.ts, agreger.ts
  indicateurs/    SMA, EMA, RSI, MACD, Bollinger, Stochastique, Heikin-Ashi (fonctions pures + tests)
  alertes/        moteur.ts (évaluation pure + tests), verification.ts (boucle), panneau.tsx, notifier.ts
  portefeuille.ts (calculs purs + tests) · categories.ts · sauvegarde.ts · miseajour.ts · theme.ts · tray.ts · stockage.ts
  graphique.tsx · watchlist.tsx · vue-portefeuille.tsx · vue-marche.tsx · reglages.tsx · App.tsx
src-tauri/src/lib.rs   coque : fenêtre, tray, démarrage avec Windows, plugins (store, notification, http, updater)
scripts/importer-excel.py   import des positions depuis un classeur Excel
```

Remplacer une source de données : écrire une classe qui implémente `DataProvider` et l'enregistrer dans `src/donnees/index.ts`.

## Importer des positions depuis Excel

`scripts/importer-excel.py` lit l'onglet « Cryptos » d'un classeur (symbole, quantité, PAMP, ATH, TP, plateforme) et, si présent, `scripts/actions.json` (voir `actions.exemple.json` ; fichier ignoré par git car il contient des montants). Il résout les symboles (Binance : USDC puis USDT puis EUR ; sinon Yahoo `SYM-USD`), vérifie leur existence et écrit un fichier à importer via Réglages › Sauvegarde › Importer › **Fusionner et recharger**.

```powershell
pip install openpyxl
python scripts/importer-excel.py mon-classeur.xlsx
```

Le fichier produit contient vos quantités : supprimez-le après usage.

## Données et limites connues

- **Actions : données différées.** Source Yahoo Finance via un **endpoint non officiel** : pas de garantie, il peut changer, être limité ou bloqué sans préavis. L'interface l'indique (« Données différées ») ; Binance est « Temps réel ».
- **Rate limit / erreurs** : chaque source a un cache et un backoff exponentiel (2 s jusqu'à 5 min, pause longue sur HTTP 429) ; pendant une pause, les dernières données connues sont réutilisées. Les actions sont interrogées par paquets de 20 (endpoint `spark`).
- **4 h sur les actions** : reconstruit à partir du 1 h, par paquets UTC qui ne suivent pas les horaires de séance.
- **Alertes** : la vérification tourne dans la page web de l'application : elle fonctionne fenêtre masquée dans la zone de notification, pas si l'application est quittée ni si Windows est en veille. Seul l'état courant est évalué. Les alertes de croisement ne regardent que les bougies clôturées ; le RSI des alertes reste fixé à 14.
- **Portefeuille** : PAMP et objectif sont dans la devise de cotation (USD pour les cryptos Binance). Une quantité déduite d'un simple montant en euros est **estimée** (« ≈ ») et n'a pas de PAMP donc pas de P&L. Un taux de change introuvable laisse la ligne non valorisée plutôt que de fausser le total.
- **ISIN** : résolu par Yahoo, qui ne renvoie souvent qu'une place de cotation ; pas d'ISIN pour les cryptos.
- Les données (watchlist, positions, alertes, réglages) sont dans `%APPDATA%\io.github.nestyxx.hune\hune.json`. Pour changer de poste, utilisez Réglages › Sauvegarde (export / import).
- Binance : l'API publique est inaccessible depuis certains pays (ex. États-Unis).
- Lightweight Charts affiche le logo d'attribution TradingView (exigé par sa licence).
