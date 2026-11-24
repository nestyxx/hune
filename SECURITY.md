# Sécurité

Hune est un outil de suivi en **lecture seule** : il n'exécute aucun ordre, ne demande aucun identifiant de courtier et ne stocke aucune clé API. Les données (watchlist, positions, alertes) restent dans un fichier local, `%APPDATA%\io.github.nestyxx.hune\hune.json`.

Connexions réseau de l'application : Binance (prix crypto, API publique), Yahoo Finance (actions, endpoint non officiel), alternative.me (indice Fear & Greed) et GitHub (recherche des mises à jour). Aucune donnée personnelle n'y est envoyée.

Les mises à jour sont signées : l'application refuse tout paquet dont la signature ne correspond pas à la clé publique intégrée.

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir de ticket public : utilisez le signalement privé de GitHub (onglet *Security* › *Report a vulnerability*) du dépôt.
