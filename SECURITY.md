# Sécurité

Hune est un outil de suivi en **lecture seule** : il n'exécute aucun ordre, ne demande aucun identifiant de courtier et ne stocke aucune clé de courtier. Les données (watchlist, positions, alertes) restent dans un fichier local, `%APPDATA%\io.github.nestyxx.hune\hune.json`.

Connexions réseau de l'application : Binance (prix crypto, API publique), Yahoo Finance (actions, endpoint non officiel), alternative.me (indice Fear & Greed) et GitHub (recherche des mises à jour). Aucune donnée personnelle n'y est envoyée.

Fonctions facultatives, désactivées par défaut : notifications à distance (ntfy, SMTP, SMS Brevo ou OVH, Telegram, Discord, webhook) et analyse par IA (OpenRouter). Elles n'envoient qu'à l'adresse que vous configurez, et seulement ce qui est nécessaire : texte de l'alerte ou du récap ; pour l'IA, cours de votre liste de suivi et, sur option expresse, le poids et la performance en pourcentage de vos lignes (jamais de montants ni de quantités). Les mots de passe, jetons et clés sont rangés dans le coffre du système (Gestionnaire d'identifiants de Windows, Trousseau sur macOS) : l'interface peut les écrire mais jamais les relire, ils n'apparaissent dans aucun fichier de Hune (données, sauvegardes, export, synchronisation) ni dans les messages d'erreur. Les requêtes sortantes passent par la coque Rust, sans redirection automatique, et n'acceptent que http(s).

Les mises à jour sont signées : l'application refuse tout paquet dont la signature ne correspond pas à la clé publique intégrée.

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir de ticket public : utilisez le signalement privé de GitHub (onglet *Security* › *Report a vulnerability*) du dépôt.
