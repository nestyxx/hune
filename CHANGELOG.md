# Changelog

Toutes les évolutions notables de Hune. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; les versions suivent [SemVer](https://semver.org/lang/fr/).
Le texte de chaque version sert de notes pour la release GitHub (`scripts/publier.ps1`).

## [0.20.0] - 2026-11-28

### Ajouté
- **Notifications à distance** (Réglages › Notifications à distance) : vos alertes, objectifs (TP) et stop loss peuvent aussi partir sur **ntfy** (serveur public ou le vôtre, jeton possible), **e-mail** (serveur SMTP : SSL, STARTTLS ou sans chiffrement), **SMS Brevo**, **SMS OVH**, **Telegram**, **Discord** ou un **webhook** (Slack, Mattermost, n8n…). Chaque canal s'active à part, choisit ce qu'il reçoit (alertes, TP/stop, récap) et a son bouton « Envoyer un test ». Un canal en panne est signalé sans bloquer les autres. Les SMS ne sont pas abonnés au récap par défaut (chaque envoi est facturé).
- **Récap quotidien** : valeur du portefeuille et variation, gain latent, meilleure et moins bonne ligne, plus fortes hausses et baisses de la liste, Fear & Greed, capitalisation crypto, alertes déclenchées depuis le dernier récap, objectifs et stops à moins de 5 %. Au choix le matin (7 h par défaut), le soir (20 h) ou les deux, à l'heure que vous voulez. Si l'ordinateur était éteint à l'heure prévue, le récap part au réveil, dans les trois heures. Bouton « Envoyer un récap maintenant » pour l'essayer.
- **Analyse du marché par IA** (OpenRouter) : bouton « Analyser le marché » dans l'onglet Marché et, au choix, un court commentaire de l'IA dans le récap. Modèle libre (« openrouter/auto » par défaut). Le portefeuille n'est envoyé que sur option expresse, en pourcentages seulement, jamais en montants ni en quantités. Analyse indicative, jamais un conseil.

### Sécurité
- Mots de passe, jetons et clés d'API sont rangés dans le **coffre du système** (Gestionnaire d'identifiants de Windows, Trousseau sur macOS), écrits par l'interface mais jamais relus : ils ne figurent ni dans `hune.json`, ni dans les sauvegardes, l'export ou la synchronisation, ni dans les messages d'erreur.
- La configuration des notifications reste **sur ce PC** (hors synchronisation) : deux ordinateurs synchronisés n'envoient pas chacun la même notification.
- Les envois partent de la coque Rust (aucun changement de la CSP de la page), sans redirection automatique ; seules les adresses http(s) sont acceptées.

## [0.19.2] - 2026-11-28

### Ajouté
- **Retirer un actif qui porte des positions ou des alertes** demande maintenant une confirmation qui explique les conséquences : ses alertes sont supprimées, ses positions sont conservées mais masquées du portefeuille (et de ses totaux) jusqu'à ce qu'on le suive à nouveau.
- **Indicateurs de chargement** sur l'écran Marché (Fear & Greed, plus fortes hausses et baisses, capitalisation crypto) et sur les répartitions du portefeuille.

### Modifié
- Les animations restent toujours actives, même quand Windows demande de les réduire.

## [0.19.1] - 2026-11-28

### Corrigé
- **Indicateurs de chargement** : le graphique d'évolution du portefeuille et le graphique principal affichent une roue de chargement (et des barres qui brillent à la place des montants) pendant le téléchargement de l'historique, au lieu d'un cadre vide.

## [0.19.0] - 2026-11-28

### Ajouté
- **Position sur un symbole non suivi** : dans « Ajouter une position », un champ de recherche (nom, symbole ou ISIN) permet de choisir un actif qui n'est pas encore dans la liste ; il y est ajouté automatiquement (et apparaît dans les graphiques) dès que la position est enregistrée.
- **Noms identiques** : quand deux actifs suivis portent le même nom (« XPeng » à Hong Kong et aux États-Unis), la place de cotation est ajoutée au nom : « XPeng (Hong Kong) », « XPeng (US) ».

## [0.18.1] - 2026-11-28

### Corrigé
- Sur le graphique, tirer la ligne d'une alerte née d'un objectif (TP) ou d'un stop déplace désormais le niveau du portefeuille lui-même (l'alerte suit), au lieu de détacher l'alerte de sa position.

## [0.18.0] - 2026-11-28

### Modifié
- **Boutons unifiés** dans toute l'interface, sur le modèle du bouton bleu des alertes : une action principale est un bouton plein bleu (« Ajouter une position », « Nouvelle alerte », « Installer et redémarrer »…), toutes les autres actions sont des boutons à contour bleu, avec le même rayon, la même épaisseur de texte et le même survol.

## [0.17.0] - 2026-11-28

### Ajouté
- **Noms lisibles pour les actions et ETF** : la liste, le portefeuille, le Marché et les alertes affichent le nom court (« XPeng », « OVHcloud », « LVMH », « Coca-Cola ») au lieu du code (« 9868.HK », « OVH.PA »). Le code et la place de cotation passent en deuxième ligne (« OVH.PA · Paris »), et le suffixe est expliqué : en tête du graphique, « · Paris » (info-bulle : Euronext Paris), « · Hong Kong », « · Xetra »… Les tris A → Z suivent le nom affiché.
- **ISIN en tête du graphique** pour vérifier d'un coup d'œil qu'on suit la bonne ligne : pastille cliquable (copie l'ISIN) et crayon pour le saisir ou le corriger. Yahoo ne fournit pas l'ISIN : Hune le déduit de Wikidata (une requête par titre, gardée sur le poste, un seul candidat dont la clé de contrôle et le pays correspondent à la place), signalé « ? » à vérifier ; celui que vous saisissez fait foi. Un symbole qui est déjà un ISIN est reconnu.
- **Objectif (TP) et stop loss tirables à la souris sur le graphique** : le lot qui porte le niveau prend la nouvelle valeur, son alerte suit, l'aimant s'applique, Échap annule.
- **PAMP manquant** : pastille « PAMP ? » dans le tableau et bandeau « N positions sans PAMP · valeur (part du portefeuille) » qui filtre ces lignes (leur P&L n'est pas compté dans le P&L latent).
- **Portefeuille plus compact** : objectif et stop dans une seule colonne, avec une barre d'avancement du prix entre votre prix d'achat et l'objectif et la valeur de la position aux deux niveaux.
- **Alertes** : « Tout replier / Tout déplier », tri « Plus proches du prix » et écart au prix actuel affiché sur chaque alerte de prix.
- **Noms de cryptos** : repli sur la recherche CoinGecko quand Yahoo ne connaît pas le jeton (AAVE, DYDX, MINA…).

### Corrigé
- Au démarrage, le portefeuille affiche « … » au lieu d'un faux « 0 € » tant que les cours et les taux ne sont pas arrivés.

## [0.16.2] - 2026-11-28

### Corrigé
- Recherche de symbole : le type et la place de cotation d'un résultat (« Matière première · Chicago Mercantile Exchange ») ne débordent plus sur le nom du résultat suivant.
- Le menu ⋯ d'un symbole proche du bas de la fenêtre s'ouvre vers le haut au lieu d'être coupé.
- Mode compact : en le quittant, une fenêtre qui était agrandie l'est de nouveau (et son état agrandi n'est plus perdu).

## [0.16.1] - 2026-11-28

### Corrigé
- Liste d'actifs : le prix d'un jeton à très petit cours (0,00000353) ne chevauche plus le symbole ; la liste est un peu plus large et le symbole se tronque au lieu de déborder.
- Les indices s'affichent par leur nom courant (« CAC 40 », « S&P 500 », « Nikkei 225 ») et « EUR=X » devient « USD/EUR ».
- Alertes : un objectif converti d'une autre devise n'affiche plus des décimales parasites (« Prix ≥ 59,9829 » au lieu de « 59,982862 ») ; un actif qui n'a qu'une alerte tient sur une seule ligne, ce qui raccourcit nettement la liste.

## [0.16.0] - 2026-11-28

### Ajouté
- **Sauvegarde automatique avant chaque mise à jour** : au clic sur « Installer et redémarrer », Hune copie d'abord `hune.json` dans `sauvegardes/avant-maj/` (les cinq dernières sont gardées). Si cette copie échoue, rien n'est installé.
- **La fenêtre garde sa taille** : taille (et état agrandi) mémorisées, y compris d'une mise à jour à l'autre.
- **Stop loss** dans le portefeuille, à côté de l'objectif (TP) : champ par lot, colonne « Stop loss » avec la distance au prix, ligne « Stop » sur le graphique et **alerte « prix ≤ stop » créée toute seule**, qui suit le stop comme celle du TP (supprimez-la, elle ne revient pas ; un stop déjà franchi ne crée rien). Les stops déjà saisis sont aussi rattrapés au lancement.
- **Valorisation aux niveaux** : sous chaque objectif et chaque stop, ce que vaudrait la position si le cours l'atteignait (avec l'écart en %) ; sur la carte « Valeur totale », la valeur du portefeuille « aux objectifs » et « aux stops » (les lignes sans niveau restent à leur valeur actuelle).
- **Logos** des actions et ETF (Financial Modeling Prep, image publique, seulement pour les titres suivis ; désactivable dans Réglages › Apparence), et pictogrammes pour les indices, matières premières et devises. Les icônes de cryptos restent embarquées.
- **Catégories** : on les **déplace par glisser-déposer** (par leur en-tête), on les renomme d'un **double-clic** sur le nom (le crayon est désormais toujours visible, atténué), et un symbole ajouté sans choix arrive dans **« Non classé »** au lieu de « Actions ». « Non classé » se renomme comme les autres.
- **Alertes** refondues : formulaire replié (bouton « Nouvelle alerte »), alertes **regroupées par actif** (ou par catégorie, par état, ou à plat) avec les déclenchées en premier, filtres Toutes / Armées / Déclenchées, recherche, tri, lignes compactes avec l'origine (TP, Stop) et actions en icônes, « Tout réarmer » et « Supprimer les déclenchées ».
- **Tracés déplaçables** : une ligne, un rayon ou un Fibonacci se déplace en le saisissant par le corps, ou se redimensionne par une extrémité ; Échap annule, l'aimant s'applique.

### Corrigé
- Noms lisibles pour les indices, matières premières et devises : « CAC 40 », « Or », « EUR/USD » au lieu de « ^FCHI », « GC=F », « EURUSD=X » (le « ^ » et les suffixes techniques ne s'affichent plus).
- Le bouton ⋯ d'un symbole ne recouvre plus la variation au survol : sa place est réservée.
- Les très petits prix (jetons à 0,00001234 et moins) s'affichent correctement sur l'échelle du graphique, dans les prix et dans les seuils d'alerte.

## [0.15.0] - 2026-11-27

### Ajouté
- **Capitalisation du marché crypto** sur l'écran Marché : dominance du Bitcoin, capitalisation totale, total sans Bitcoin (« TOTAL2 ») et total sans Bitcoin ni Ethereum (« TOTAL3 »), avec leur variation sur 24 h et une mini-courbe. Source : l'API publique CoinGecko (une requête toutes les 5 minutes, sans clé ni compte). CoinGecko compte plus de 20 000 jetons là où TradingView s'arrête aux 125 premiers : les valeurs diffèrent de 2 à 6 %, la tendance est la même (info-bulle sur le titre).
  - L'API gratuite ne fournit que la valeur du moment : Hune construit l'historique localement, un point tous les 15 minutes (30 jours gardés). Les courbes et les variations de 24 h apparaissent donc après une journée d'utilisation ; en attendant, seule la variation de la capitalisation totale, donnée par CoinGecko, est affichée.

## [0.14.1] - 2026-11-26

### Ajouté
- **Version Mac** (macOS 11 ou plus récent), en un seul `.dmg` pour Apple Silicon et Intel, construit par GitHub Actions (workflow « macOS ») et joint à la release. L'application n'est pas signée par Apple : clic droit › Ouvrir au premier lancement (voir le README). Les mises à jour automatiques ne sont pas encore proposées sur Mac.
  - Barre de titre superposée avec les boutons de fenêtre du système à gauche ; icône dans la barre de menus ; un clic sur le Dock rouvre la fenêtre masquée ; Cmd+Q quitte.
  - Les textes suivent le système : « barre de menus » au lieu de « zone de notification », ⌘K au lieu de Ctrl+K, « démarrer avec macOS ».

## [0.14.0] - 2026-11-26

### Ajouté
- **Synchronisation entre appareils par dossier** (Réglages › Synchronisation) : on choisit un dossier déjà synchronisé par OneDrive, iCloud Drive, Google Drive, Synology Drive ou Syncthing, et Hune y garde un fichier `hune-sync.json`, fusionné avec les données au démarrage, trois secondes après une modification, chaque minute et au retour sur la fenêtre. Aucun serveur ni compte. Sont synchronisés la liste (actifs, catégories, ordre), le portefeuille, les alertes et les tracés ; les préférences d'affichage restent locales.
  - **Fusion à trois voies** : chaque côté est comparé au dernier état synchronisé. Un élément modifié, ajouté ou supprimé d'un seul côté suit ce côté ; modifié des deux côtés, le plus récent gagne ; une modification l'emporte toujours sur une suppression faite ailleurs. L'ordre manuel de la liste suit celui qui l'a changé.
  - **Garde-fous** : un appareil dont les données sont vides ne peut pas effacer celles des autres ; le fichier est écrit de façon atomique et la version précédente est gardée (`hune-sync.precedent.json`) ; un fichier étranger ou d'une version plus récente est refusé avec un message clair.
  - **Chiffrement facultatif** (AES-256-GCM, clé dérivée du mot de passe par PBKDF2) : le fichier est illisible sans le mot de passe, même pour le fournisseur du Drive.
  - Nouveaux composants : `tauri-plugin-dialog` (sélecteur de dossier) et deux commandes qui ne lisent ou n'écrivent que `hune-sync.json` dans le dossier choisi.

### Modifié
- Les alertes créées automatiquement pour les objectifs (TP) ont un identifiant stable et la liste des lots dont on a supprimé l'alerte est enregistrée avec les données, pour qu'elles se synchronisent sans doublon ni retour de l'alerte supprimée.

## [0.13.0] - 2026-11-26

### Ajouté
- **Classer sa liste à la main** : on attrape une ligne de la liste d'actifs et on la glisse où l'on veut (BTC et ETH tout en haut, par exemple). L'ordre est mémorisé. Glisser sur une autre catégorie y range l'actif, glisser sur l'en-tête d'une catégorie le place en fin de catégorie ; un trait bleu montre l'endroit de dépôt, Échap annule. Si la liste était triée par nom ou par variation, l'ordre affiché devient « Mon ordre » dès le premier déplacement.

### Modifié
- Le tri « Ordre d'ajout » s'appelle désormais « Mon ordre », puisque c'est celui que l'on règle à la main.

## [0.12.1] - 2026-11-26

### Modifié
- **Pastilles d'alerte** : elles signalent désormais une alerte ou un objectif (TP) **atteint**, plus une alerte créée. Dans le menu, la pastille de « Alertes » compte les alertes déclenchées depuis votre dernière visite de l'onglet (elle disparaît quand vous l'ouvrez). Dans la liste d'actifs, la pastille rouge indique les alertes déclenchées de l'actif, jusqu'à ce que vous les réarmiez ou les supprimiez.

### Ajouté
- **Alertes TP pour le portefeuille existant** : au lancement, Hune crée l'alerte « prix ≥ objectif » des objectifs déjà saisis qui n'en ont pas et ne sont pas encore atteints (une seule fois par objectif, sans doublon avec une alerte existante). Si vous supprimez l'alerte d'un objectif, elle n'est pas recréée tant que vous ne changez pas cet objectif. Le bouton « Alertes aux objectifs » reste disponible.

## [0.12.0] - 2026-11-26

### Ajouté
- **Vrais noms des cryptos** : Bitcoin, Ethereum, Chainlink… s'affichent dans le portefeuille, la liste et l'en-tête du graphique à la place de « BTC/USDC ». Hune les lit une fois par jeton dans la recherche Yahoo Finance (seul le symbole du jeton est envoyé) et les garde sur le poste.
- **Bulle d'actualités sur les tuiles du Marché** : un petit rond rouge avec le nombre d'articles de moins de 24 h non ouverts, en haut de la tuile d'un actif, pour comprendre d'un coup d'œil un mouvement rapide avant d'ouvrir le graphique puis les actualités. Interrogation deux actifs à la fois, toutes les 10 minutes, seulement quand l'écran Marché est affiché.
- **Infobulles aux couleurs de l'application** à la place de celles de Windows, pour tous les textes d'aide au survol (le texte reste lu par les lecteurs d'écran).
- **Aimant sur le graphique**, comme sur TradingView : en traçant une ligne, en déplaçant une alerte à la souris ou en créant une alerte par clic droit, le prix se cale sur l'ouverture, le plus haut, le plus bas ou la clôture de la bougie voisine quand il en est à moins de 10 pixels. Bouton en forme d'aimant dans la barre d'outils de tracé (activé par défaut, choix mémorisé).

### Modifié
- **Bouton « Actualités »** bien plus visible quand il y a du nouveau : il passe en rouge et affiche le nombre d'articles de moins de 24 h non ouverts (9+ au-delà), au lieu d'une simple pastille.
- **Devise du PAMP et de l'objectif** : la devise choisie pour un lot est désormais mémorisée. Ce qui est noté en euros reste en euros (et en dollars, en dollars) ; Hune convertit au taux du jour pour les valeurs, tableaux, graphiques et alertes, et remet à jour la conversion quand le taux change (écart de plus de 0,05 %). Un seul sélecteur de devise par lot, à côté de l'objectif.
- **Portefeuille** : le nom de l'actif est aligné sur la ligne du symbole.

## [0.11.1] - 2026-11-26

### Ajouté
- **Puce « nouvelle actualité »** sur le bouton Actualités au-dessus du graphique : elle apparaît quand un article de moins de 24 h cite l'actif et que vous ne l'avez pas encore ouvert (l'infobulle donne le titre, l'éditeur et l'ancienneté). Les titres viennent de la recherche Yahoo Finance, déjà utilisée pour les cours, pour l'actif affiché seulement et rafraîchis toutes les 10 minutes. Les cryptos très suivies (Bitcoin, Ethereum…) ont des articles ; les petits jetons en ont rarement.

### Corrigé
- **Devise des prix d'un lot** : changer la devise à côté du PAMP ou de l'objectif convertit maintenant aussitôt la valeur affichée (au taux du jour). Avant, le choix ne s'appliquait qu'à la saisie suivante, ce qui donnait l'impression qu'il n'était pas pris en compte. La valeur reste enregistrée dans la devise de cotation de l'actif.

## [0.11.0] - 2026-11-26

### Ajouté
- **Actualités et fiche de l'actif** : deux boutons au-dessus du graphique ouvrent, dans votre navigateur, les actualités de l'actif (Yahoo Finance) et sa fiche (CoinMarketCap pour une cinquantaine de cryptos courantes, CoinGecko en recherche pour les autres, Yahoo Finance pour les actions). Rien n'est chargé par Hune : le lien ne s'ouvre qu'au clic, et seul le symbole figure dans l'adresse. Nouveau composant `tauri-plugin-opener`, limité à ces trois sites.
- **Alerte automatique pour chaque objectif (TP)** : saisir ou modifier l'objectif d'un lot crée l'alerte « prix ≥ objectif » correspondante (visible sur le graphique, notification au franchissement). Elle suit l'objectif si vous le changez et disparaît si vous l'effacez ou supprimez le lot ; un objectif déjà atteint ou une alerte identique déjà armée n'en crée pas. Le bouton « Alertes aux objectifs » reste disponible pour les objectifs déjà saisis.

- **Matières premières et devises dans la recherche** : l'or (`GC=F`), l'argent, le pétrole ou une paire comme `EURUSD=X` se trouvent désormais en tapant leur nom, avec leur type (« Matière première », « Devise »). Seuls les symboles continus sont proposés, pas les contrats datés. Les indices (CAC 40, S&P 500…) étaient déjà trouvables.

### Modifié
- **Portefeuille** : le nom de l'actif s'affiche à côté du symbole en texte normal, grisé et tronqué, au lieu d'un petit indice ; il est omis pour les paires crypto où il répéterait le symbole (BTC/USDC).

## [0.10.3] - 2026-11-26

### Ajouté
- **Devise de saisie du PAMP et de l'objectif (TP)** : sur chaque lot et dans le formulaire d'ajout, on choisit la devise dans laquelle on saisit le prix (celle de cotation de l'actif, ou l'euro / le dollar). Il est converti au taux du jour et enregistré dans la devise de cotation. Utile pour une action cotée en dollars suivie depuis un compte en euros : un objectif de 225 € n'est plus pris pour 225 $.

## [0.10.2] - 2026-11-26

### Modifié
- **Icônes unifiées** : les emojis et symboles colorés (🔔 🗑 ✎ ⚙ ✕ ⋯ ＋, flèches d'import/export et de tri) sont remplacés par les icônes monochromes du menu (lucide, embarquées dans l'application), dans le menu du graphique, la liste d'actifs, le portefeuille et les alertes. Les étiquettes d'alerte sur l'échelle de prix n'affichent plus que le sens (≥ / ≤).

## [0.10.1] - 2026-11-26

### Modifié
- **Interface harmonisée** : les lignes survolées des cartes « Plus fortes hausses / baisses » et les entrées de tous les menus (graphique, liste, recherche) ont désormais des coins arrondis ; les rayons des bordures suivent trois niveaux cohérents (grands conteneurs, menus, entrées de menu).

### Corrigé
- Liste d'actifs avec mini-courbes : les symboles longs (PEPEUSDC, SHIBUSDC…) ne débordent plus sur la courbe et ne passent plus sur deux lignes (la liste est un peu plus large dans ce mode).

## [0.10.0] - 2026-11-26

### Ajouté
- **Valeurs aux sommets et aux creux** du graphique, comme sur ProRealTime : les plus hauts et plus bas dominants (au-delà de leurs bougies voisines) sont étiquetés avec leur prix, ainsi que le plus haut et le plus bas de la vue. Le nombre d'étiquettes s'adapte au zoom pour rester lisible. Bouton « Hauts / bas » (activé par défaut, choix mémorisé).
- **Export CSV du portefeuille** : positions (tableau affiché, devise, plateforme et filtre appliqués) et transactions avec le gain réalisé de chaque vente. Séparateur « ; », virgule décimale et BOM pour Excel ; les textes qui ressemblent à une formule sont neutralisés.
- **Gains réalisés** sur les ventes de l'historique de transactions importé (méthode du prix moyen, hors frais) : carte « Réalisé » et colonne dans l'onglet Transactions.
- **Camembert de répartition** (par catégorie et par plateforme) avec légende et pourcentages.
- **Mini-courbes de 7 jours** dans la liste d'actifs (bouton pour les masquer ; résultats gardés 30 minutes, aucune requête supplémentaire si désactivées).

### Corrigé
- Les boutons en haut du graphique ne recouvrent plus la légende OHLC sur une fenêtre étroite.

## [0.9.0] - 2026-11-26

### Ajouté
- **Graphique de l'évolution de la valeur du portefeuille** : 24 h, 7 j, 30 j, 90 j, 1 an ou Tout, avec survol (valeur et variation depuis le début de la période). Reconstitué localement à partir des cours et des quantités détenues ; l'historique des transactions importées donne les quantités exactes, un lot sans historique est supposé détenu sur toute la période (une note l'indique, ainsi que les actifs non inclus). La période est mémorisée.
- **Nouvelles cartes** : variation de la valeur totale, base de coût, meilleure et moins bonne performance.
- **Filtre par plateforme** (« Vue d'ensemble », Ledger, PEA…) qui recalcule cartes, graphique et tableau.
- **Onglet « Transactions »** : achats et ventes issus de l'import CSV.
- **Icônes des cryptos** (liste d'actifs, en-tête du graphique, portefeuille, Marché) : 223 icônes embarquées dans l'application, aucune image n'est chargée depuis Internet. Les actions et les tokens sans icône ont une pastille colorée avec leurs initiales. Licence MIT des icônes dans `THIRD-PARTY-NOTICES.md` ; `scripts/preparer-icones.mjs` régénère le jeu.

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
