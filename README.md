<p align="center"><img src="branding/icone.svg" alt="Hune" width="112" height="112"></p>

<h1 align="center">Hune</h1>

<p align="center"><strong>Suivez vos cryptos et vos actions sur un seul écran, en local, sans compte ni abonnement.</strong><br>
<em>A free, local, read-only desktop app to track crypto and stocks: charts, indicators, alerts, portfolio.</em></p>

<p align="center">
  <a href="https://github.com/nestyxx/hune/releases/latest"><img alt="Dernière version" src="https://img.shields.io/github/v/release/nestyxx/hune?label=version&color=4f7fe0"></a>
  <a href="https://github.com/nestyxx/hune/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/nestyxx/hune/ci.yml?branch=main&label=tests"></a>
  <a href="LICENSE"><img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-4f7fe0"></a>
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%20%2F%2011-4f7fe0">
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/captures/graphique-sombre.png">
    <img alt="Graphique en chandeliers avec SMA, RSI et MACD, alertes tracées sur le cours" src="docs/captures/graphique-clair.png" width="900">
  </picture>
</p>

> *La hune : la plateforme en haut du mât d'un navire, d'où l'on guette l'horizon.*

## Pourquoi Hune ?

Hune réunit ce qui sert au quotidien (graphiques, indicateurs, alertes, portefeuille) dans une petite application Windows **gratuite, légère et privée** :

- **Lecture seule** : aucune fonction de trading, aucun accès à un compte de courtier, aucune clé API à fournir.
- **Tout reste chez vous** : watchlist, positions et alertes sont dans un fichier local. Pas de compte, pas de serveur, pas de télémétrie.
- **Ça tourne en arrière-plan** : fermez la fenêtre, Hune continue de surveiller vos alertes depuis la zone de notification et vous prévient par une notification Windows.

## Ce qu'elle sait faire

### Graphiques et indicateurs

Chandeliers de **15 min à 1 mois** (15 min, 1 h, 4 h, 1 j, 1 sem, 1 mois), Heikin-Ashi, ligne ou aire. SMA, EMA, bandes de Bollinger, RSI, MACD, stochastique et volume, tous **paramétrables**, avec échelle logarithmique, légende OHLC et recentrage en un geste. Cryptos en temps réel via Binance, actions via Yahoo Finance (données différées).

**Historique long** : à partir du journalier, choisissez la profondeur *Standard*, *5 ans* ou *Max*. Binance remonte jusqu'au début de la cotation de la paire (BTC/USDC : 2018, BTC/USDT : 2017) ; Yahoo remonte jusqu'à l'introduction en bourse (Microsoft : 1986) ou à la création de la crypto (BTC : 2014). Aucune clé n'est nécessaire. En intraday, les sources limitent elles-mêmes la profondeur.

### Alertes

Prix, variation en %, RSI, cours qui franchit une moyenne mobile, croisement MACD/signal, croisement de moyennes (golden / death cross). Une alerte se déclenche **une seule fois** puis se réarme d'un clic. Elles sont **tracées sur le graphique**, un **clic droit** sur le cours crée une alerte à ce niveau, et le bouton crayon permet de **modifier** une alerte existante.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/captures/alertes-sombre.png">
    <img alt="Liste des alertes armées et déclenchées" src="docs/captures/alertes-clair.png" width="900">
  </picture>
</p>

### Portefeuille

Saisissez vos lots (quantité, prix d'achat moyen, objectif, plateforme) : Hune calcule la **valeur en euros** (conversion des devises), le **P&L latent**, le poids de chaque ligne, la distance à l'objectif et la répartition par catégorie et par plateforme. Un bouton crée les alertes aux objectifs en un clic.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/captures/portefeuille-sombre.png">
    <img alt="Portefeuille valorisé en euros avec P&L et répartition" src="docs/captures/portefeuille-clair.png" width="900">
  </picture>
</p>

### Vue d'ensemble du marché

Une carte thermique de votre watchlist par catégorie, les plus fortes hausses et baisses du moment, et l'indice crypto *Fear & Greed*.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/captures/marche-sombre.png">
    <img alt="Carte thermique de la watchlist et indice Fear and Greed" src="docs/captures/marche-clair.png" width="900">
  </picture>
</p>

### Un affichage qui s'adapte

Barre de titre intégrée, navigation latérale que l'on peut **réduire aux seules icônes**, liste d'actifs masquable (`L`), **mode compact** (une petite fenêtre qui ne montre que la liste et les prix, idéale à côté d'un autre travail) et option **garder au premier plan**. Trois thèmes : clair, sombre ou automatique.

<table>
  <tr>
    <td width="75%" valign="top"><img alt="Navigation réduite aux icônes, fenêtre en grand" src="docs/captures/menu-reduit-clair.png" width="100%"></td>
    <td width="25%" valign="top">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/captures/compact-sombre.png">
        <img alt="Mode compact : la liste et les prix dans une petite fenêtre" src="docs/captures/compact-clair.png" width="100%">
      </picture>
    </td>
  </tr>
</table>

### Et aussi

Recherche par **symbole, nom ou ISIN** · **catégories** personnalisables · raccourcis clavier (`Ctrl+K`, `↑`/`↓`, `1`-`6`, `R`, `L`…) · démarrage avec Windows · **sauvegarde** par export/import JSON, **copie automatique quotidienne** et restauration en un clic (proposée d'elle-même si la liste est vide) · **mises à jour automatiques** signées.

> Les captures ci-dessus utilisent un portefeuille **fictif**.

## Installer

1. Téléchargez `Hune_X.Y.Z_x64-setup.exe` depuis la [dernière release](https://github.com/nestyxx/hune/releases/latest).
2. Lancez-le : l'installation se fait pour votre utilisateur, sans droits administrateur.
3. L'installeur n'est pas signé par un certificat de signature de code : **Windows SmartScreen** peut afficher « Windows a protégé votre ordinateur ». Cliquez sur *Informations complémentaires* puis *Exécuter quand même*. Le code source est ici, vous pouvez le relire ou compiler vous-même (voir [CONTRIBUTING.md](CONTRIBUTING.md)).

Prérequis : Windows 10 ou 11 (WebView2, déjà présent sur Windows 11). Hune se met ensuite à jour toute seule : une bannière vous propose l'installation, rien n'est installé sans votre clic.

## Premiers pas

1. Tapez un symbole, un nom ou un ISIN dans la recherche (`Ctrl+K`) : `BTC`, `AAPL`, `LVMH`, `FR0000121014`… puis `Entrée`.
2. Ouvrez l'onglet **Alertes** ou faites un clic droit sur le graphique pour être prévenu à un niveau de prix.
3. Dans **Portefeuille**, ajoutez vos positions pour suivre votre valeur en euros.
4. Dans **Réglages › Sauvegarde**, exportez de temps en temps un fichier JSON : c'est aussi le moyen de changer de poste.

Vous avez déjà vos positions dans un tableur ? Voir [`scripts/importer-excel.py`](scripts/importer-excel.py).

## Confidentialité et réseau

Hune ne contacte que des services publics de données, **sans jamais leur envoyer d'information vous concernant** : Binance (prix crypto), Yahoo Finance (actions et devises), alternative.me (indice Fear & Greed) et GitHub (recherche de mises à jour). Vos données sont dans `%APPDATA%\io.github.nestyxx.hune\hune.json`. Détails dans [SECURITY.md](SECURITY.md).

## Limites à connaître

- **Actions : données différées** (souvent ~15 min). La source est un **endpoint Yahoo Finance non officiel** : il peut changer, être limité ou bloqué sans préavis. L'interface indique « Données différées » ; les cryptos Binance sont en temps réel.
- Les **alertes ne tournent que si Hune est lancée** (fenêtre fermée dans la zone de notification, oui ; application quittée ou Windows en veille, non). Seul l'état courant est évalué.
- Le **4 h** des actions est reconstruit à partir du 1 h, par paquets UTC qui ne suivent pas les horaires de séance.
- **Profondeur d'historique** : *5 ans* et *Max* ne s'appliquent qu'aux intervalles journalier, hebdomadaire et mensuel. En intraday : environ 500 bougies pour les cryptos (≈ 5 jours en 15 min), 1 mois en 15 min et 6 mois en 1 h pour les actions. Une paire récente (ex. un token coté depuis peu) n'a évidemment pas d'historique plus ancien.
- **Portefeuille** : PAMP et objectifs sont dans la devise de cotation de l'actif. Une quantité déduite d'un simple montant en euros est **estimée** (marquée « ≈ ») et n'a pas de P&L.
- L'API publique de Binance est inaccessible depuis certains pays (par exemple les États-Unis).
- Seul Windows est pris en charge pour l'instant.

## Avertissement

Hune est un outil d'information et ne fournit **aucun conseil en investissement**. Les cours peuvent être différés, incomplets ou erronés ; le logiciel est fourni « tel quel », sans garantie (voir la [licence](LICENSE)). Vérifiez toujours vos décisions auprès de votre courtier. Hune n'est affilié ni à Binance, ni à Yahoo, ni à TradingView ; ces noms appartiennent à leurs propriétaires.

## Contribuer

Les idées, retours et contributions sont les bienvenus : ouvrez un ticket pour discuter d'une évolution ou signaler un problème. Pour développer, tester et publier une version, voir [CONTRIBUTING.md](CONTRIBUTING.md). L'historique des versions est dans le [CHANGELOG](CHANGELOG.md).

## Licence et remerciements

[MIT](LICENSE). Hune s'appuie sur [Tauri](https://tauri.app), [React](https://react.dev), [Vite](https://vite.dev) et [Tailwind CSS](https://tailwindcss.com).

Graphiques : [TradingView Lightweight Charts™](https://www.tradingview.com/lightweight-charts/) (licence Apache 2.0). Le logo d'attribution TradingView affiché sur les graphiques est exigé par cette licence.
