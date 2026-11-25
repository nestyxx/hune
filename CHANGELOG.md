# Changelog

Toutes les évolutions notables de Hune. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; les versions suivent [SemVer](https://semver.org/lang/fr/).
Le texte de chaque version sert de notes pour la release GitHub (`scripts/publier.ps1`).

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
