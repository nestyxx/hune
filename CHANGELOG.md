# Changelog

Toutes les évolutions notables de Hune. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; les versions suivent [SemVer](https://semver.org/lang/fr/).
Le texte de chaque version sert de notes pour la release GitHub (`scripts/publier.ps1`).

## [0.8.0] - 2026-11-26

### Ajouté
- **Portefeuille en euros ou en dollars** : un sélecteur « € Euro | $ Dollar » convertit valeur totale, P&L, lignes et répartitions au taux du jour. Les pourcentages ne changent pas. Si le taux est introuvable, « — » est affiché plutôt qu'un faux total.
- **Le choix de devise et le tri du tableau du portefeuille sont mémorisés** (et inclus dans la sauvegarde).

### Modifié
- Taux de change : si Yahoo ne répond pas, le dollar est déduit de la paire EUR/USDC de Binance.

## [0.7.1] - 2026-11-26

### Ajouté
- **Liste d'actifs sur une ligne** : un bouton à côté du compteur d'actifs affiche symbole, prix et variation sur une seule ligne (30 px au lieu de 54), pour voir presque deux fois plus d'actifs sans défiler. Le nom reste visible en info-bulle. Le choix est mémorisé.

## [0.7.0] - 2026-11-26

### Ajouté
- **Outils de tracé** sur le graphique : ligne horizontale, ligne de tendance, rayon, retracement de Fibonacci (niveaux 0 à 1 avec prix) et gomme. Les tracés sont mémorisés par actif, suivent le zoom et l'échelle logarithmique, et font partie de la sauvegarde. Un clic droit sur un tracé propose de le supprimer.
- **Portefeuille sur le graphique** : bouton « Portefeuille » affichant le PAMP, l'objectif (TP), un niveau par lot et, pour les transactions importées, une flèche d'achat ou de vente sur la bougie (prix indiqué). Les repères viennent de l'import CSV : réimportez votre fichier pour les voir.
- **Alertes modifiables depuis le graphique** : glisser la ligne d'une alerte de prix la déplace (elle est réarmée, son sens s'ajuste au prix actuel) ; double-clic ou clic droit › « Modifier cette alerte » ouvre le formulaire ; clic droit › « Supprimer cette alerte ».
- **Réglage « Variation des cryptos »** : 24 h glissantes (Binance, comme avant) ou depuis 00:00 UTC (la définition de TradingView). S'applique à la liste, à la carte Marché et à l'en-tête.

### Modifié
- **Vue par défaut du graphique** : journalier, bougies, échelle logarithmique, volume + SMA 20 + EMA 50 + RSI 14. À l'ouverture et au recentrage, le graphique montre 6 mois en journalier (durée adaptée aux autres intervalles). Vos réglages déjà enregistrés ne changent pas.
- Les cartes ne se soulèvent plus au survol (bordure et ombre légères conservées).

## [0.6.1] - 2026-11-26

### Corrigé
- **Données lues « vides » au démarrage** : si le fichier de données était momentanément inaccessible, Hune démarrait sur une liste vide et la première modification aurait pu écraser les vraies données. Hune détecte maintenant ce cas (lecture vide alors que des données existent sur le disque), relit le fichier plusieurs fois, puis affiche un écran explicatif avec « Réessayer » et la restauration d'une copie automatique. Rien n'est écrit tant que la lecture n'a pas réussi.
- Une ouverture ratée du fichier de données ne reste plus en mémoire : la tentative suivante repart de zéro.

## [0.6.0] - 2026-11-25

### Ajouté
- **Import de transactions (CSV)** dans l'onglet Portefeuille : à partir d'un historique d'achats et de ventes (export CoinMarketCap, courtier, exchange…), Hune reconstitue la quantité détenue et le prix d'achat moyen (frais d'achat inclus). Un aperçu détaille chaque token avant toute écriture ; les tokens déjà suivis sont réutilisés, les autres sont ajoutés à la watchlist (paire Binance en EUR, sinon USDC, sinon USDT). Réimporter le même fichier met à jour au lieu de dupliquer ; les lots des autres plateformes et les objectifs sont conservés.
- Les colonnes sont reconnues automatiquement (séparateur `,` `;` ou tabulation, décimales `.` ou `,`) ; les lignes strictement identiques (par exemple une migration MATIC → POL consignée deux fois) peuvent être retirées.

## [0.5.5] - 2026-11-25

### Corrigé
- **Formulaire d'alertes** : les champs perdaient le focus après chaque caractère tapé (le formulaire était recréé à chaque frappe). Valable aussi pour la création d'une alerte.

### Modifié
- **Dézoomer charge plus d'historique** : au journalier, hebdomadaire et mensuel, dézoomer au-delà de la première bougie passe automatiquement à la profondeur suivante (Standard, 5 ans, puis Max). En intraday, la profondeur reste limitée par les sources.

## [0.5.4] - 2026-11-25

### Corrigé
- Barre de titre : le nom « Hune » est maintenant centré verticalement sur le logo (le tracé de la police serif était 2 px plus haut).
- Modification d'alerte : une vérification déjà en cours au moment de l'enregistrement ne peut plus déclencher l'alerte avec son ancienne condition.

### Modifié
- Une alerte modifiée affiche une confirmation (« Alerte modifiée et réarmée »).

## [0.5.3] - 2026-11-25

### Modifié
- Barre de titre : le logo (16 px) a maintenant la largeur du tracé des icônes de navigation, bords et axe alignés avec elles ; le nom « Hune » reste à l'aplomb des libellés.
- **Réglages** est descendu en bas du menu latéral, avec les autres actions (liste, mode compact, thème, réduire le menu). Le raccourci `P` est inchangé.

## [0.5.2] - 2026-11-25

### Modifié
- Barre de titre : le logo est un peu plus petit (18 px) et tombe à l'aplomb des icônes de navigation, le nom « Hune » à l'aplomb de leurs libellés.

## [0.5.1] - 2026-11-25

### Ajouté
- **Modification d'une alerte** : un bouton crayon sur chaque alerte recharge ses réglages dans le formulaire (actif, condition, seuil, intervalle…). L'alerte enregistrée est réarmée, y compris si elle était déclenchée.

## [0.5.0] - 2026-11-25

### Ajouté
- **Refonte visuelle** : palette tirée du logo (bleu ciel pastel, bleu, corail), typographies Figtree et Newsreader (embarquées, SIL OFL), barre de titre intégrée, navigation latérale avec icônes, panneau arrondi, survols et animations discrètes (désactivées si Windows demande de réduire les animations).
- **Mode compact** (petite fenêtre avec la liste et les prix), **menu réduit** aux icônes, liste d'actifs masquable (`L`) et option **garder au premier plan**.
- **Historique long** : intervalles 1 semaine et 1 mois, et profondeur *Standard / 5 ans / Max* à partir du journalier (Binance paginé jusqu'au début de la cotation ; Yahoo depuis l'introduction en bourse).
- **Restauration des copies automatiques** dans Réglages › Sauvegarde, et proposition de restauration au démarrage quand la liste est vide alors qu'une copie contient des données.
- Installeur aux couleurs de Hune (bandeau et panneau latéral).
- Captures du README : mode compact et menu réduit.

### Modifié
- Hune n'écrit plus ses réglages au démarrage, seulement quand une valeur change : une lecture ratée ne peut plus écraser de bonnes données par des valeurs par défaut.
- La liste d'actifs n'est affichée que sur l'onglet Graphique : le portefeuille et les autres écrans disposent de toute la largeur.
- Raccourcis : `1` à `6` pour les intervalles, `L` pour la liste.
- Les chiffres s'affichent avec une espace ordinaire entre les milliers (le caractère spécial précédent disparaissait dans la police des titres).
- Boutons « Log » et « Recentrer » en surimpression sur le graphique.

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
