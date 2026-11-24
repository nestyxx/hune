# Changelog

Toutes les évolutions notables de Hune. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; les versions suivent [SemVer](https://semver.org/lang/fr/).
Le texte de chaque version sert de notes pour la release GitHub (`scripts/publier.ps1`).

## [0.4.3] - 2026-11-25

### Ajouté
- Projet ouvert au public : licence MIT, présentation détaillée dans le README, captures d'écran (thèmes clair et sombre) générées avec des données de démonstration.
- `npm run captures` : régénère les captures du README à chaque version.

### Modifié
- Message de mise à jour plus clair quand la dernière version est introuvable (hors ligne ou dépôt inaccessible), au lieu du texte technique.

### Corrigé
- Marché : « Plus fortes hausses » n'affiche plus de titre en baisse (ni l'inverse) quand il y a moins de cinq valeurs de chaque sens.
- Portefeuille : les noms longs sont tronqués avec des points de suspension (nom complet en info-bulle) au lieu d'être coupés en plein mot.

## [0.4.2] - 2026-11-25

### Ajouté
- Sauvegarde automatique quotidienne du fichier de données au démarrage (14 jours conservés, jamais à partir d'un fichier vide).

## [0.4.1] - 2026-11-24

### Modifié
- Nouvelle icône : trois bougies montantes sur un fond bleu ciel pastel, aux coins arrondis.

## [0.4.0] - 2026-11-24

Première version publiée sous le nom Hune.

### Ajouté
- Watchlist avec recherche par symbole, nom ou ISIN, catégories personnalisables et tri.
- Graphiques en chandeliers (15 min, 1 h, 4 h, 1 j) : Bougies, Heikin-Ashi, Ligne, Aire ; Volume, SMA, EMA, Bollinger, RSI, MACD, Stochastique, paramétrables.
- Alertes : prix, variation en %, RSI, franchissement de moyenne, croisement MACD/signal, croisement de moyennes ; dessinées sur le graphique ; création par clic droit.
- Portefeuille valorisé en euros (lots, PAMP, objectifs, P&L latent, répartitions).
- Carte du marché et indice crypto Fear & Greed.
- Notifications Windows, fonctionnement en zone de notification, démarrage avec Windows.
- Thème clair, sombre ou automatique ; raccourcis clavier.
- Sauvegarde, export et import JSON (fusion ou remplacement).
- Mises à jour automatiques signées depuis les releases GitHub.
