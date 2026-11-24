# Contribuer à Hune

Merci de l'intérêt porté au projet. Pour une évolution importante, ouvrez d'abord un ticket afin d'en discuter.

## Développement

Prérequis : Node 22+, Rust stable (édition 2024) avec les outils C++ de Visual Studio 2022 (ou Build Tools), WebView2.

```powershell
npm install
npm run dev        # fenêtre Tauri (la première compilation Rust prend quelques minutes)
npm test           # tests unitaires : indicateurs, alertes, portefeuille, cache/backoff, import…
npm run web        # interface seule dans un navigateur (http://localhost:1421) : Binance marche, pas Yahoo (CORS)
npx tsc            # typage
cd src-tauri; cargo test
```

Conventions : noms de fichiers et commentaires en français, commentaires utiles (le « pourquoi »), calculs purs et testés (`src/indicateurs`, `src/alertes/moteur.ts`, `src/portefeuille.ts`).

### Structure

```
src/
  donnees/        sources : fournisseur.ts (interface DataProvider), binance.ts, yahoo.ts, requeteur.ts (cache + backoff),
                  change.ts (devises), isin.ts, sentiment.ts, agreger.ts
  indicateurs/    SMA, EMA, RSI, MACD, Bollinger, Stochastique, Heikin-Ashi (fonctions pures + tests)
  alertes/        moteur.ts (évaluation pure + tests), verification.ts (boucle), panneau.tsx, notifier.ts
  portefeuille.ts · categories.ts · sauvegarde.ts · miseajour.ts · theme.ts · tray.ts · stockage.ts
  graphique.tsx · watchlist.tsx · vue-portefeuille.tsx · vue-marche.tsx · reglages.tsx · App.tsx
src-tauri/src/lib.rs   coque : fenêtre, tray, démarrage avec Windows, plugins (store, notification, http, updater)
scripts/               importer-excel.py, publier.ps1, captures.mjs
branding/icone.svg     source de l'icône (npx tauri icon branding/icone.svg)
```

Remplacer une source de données : implémenter l'interface `DataProvider` et l'enregistrer dans `src/donnees/index.ts`.

## Publier une version (checklist à suivre à chaque fois)

1. **Code et tests** : `npx tsc`, `npm test` et `cargo test` au vert.
2. **CHANGELOG** : ajouter une section `## [X.Y.Z] - AAAA-MM-JJ` (Ajouté / Modifié / Corrigé). Son texte devient les notes de la release ; le script refuse de publier sans elle.
3. **Captures** : `npm run captures` régénère `docs/captures/*.png` (clair et sombre) avec un portefeuille **fictif** dans une instance isolée. Relire chaque image : elle doit refléter l'interface actuelle et ne montrer aucune donnée personnelle.
4. **README** : mettre à jour la description si une fonction a été ajoutée, modifiée ou retirée (fonctions, limites, captures citées).
5. **Version** : même numéro dans `package.json`, `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json`, puis `cargo check` pour mettre à jour `Cargo.lock`.
6. **Commit et push** sur `main`.
7. **Publication** : `powershell -File scripts/publier.ps1`. Le script vérifie les versions et le changelog, lance tests et build signé, pose le tag, crée la release GitHub (installeurs + `latest.json`) avec les notes du changelog.

La clé de signature des mises à jour (`%USERPROFILE%\.tauri\hune.key` et son mot de passe) reste sur le poste du mainteneur, elle n'est jamais envoyée à GitHub. Sans elle, les applications installées ne pourraient plus se mettre à jour : à sauvegarder.

Le workflow `release.yml` (manuel) permet de publier depuis GitHub si l'on ajoute les secrets `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## Données personnelles

Ne commitez jamais de positions, d'exports ou de fichiers d'import réels : `scripts/actions.json`, `*.xlsx` et `hune-import*.json` sont ignorés par git. Les captures n'utilisent que `scripts/donnees-demo.json` (données fictives).
