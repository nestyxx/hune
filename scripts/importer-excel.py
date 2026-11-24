"""
Prépare un fichier d'import pour Hune à partir de :
  - l'onglet « Cryptos » d'un classeur Excel (colonnes : symbole, quantité, PAMP, ATH, vide, TP, vide, plateforme) ;
  - la liste d'actions de `scripts/actions.json` (copiez `actions.exemple.json` : symboles Yahoo à résoudre vous-même,
    ce fichier est ignoré par git car il contient vos montants).

Usage :  python scripts/importer-excel.py classeur.xlsx [sortie.json]
Puis dans l'application : Réglages › Sauvegarde › Importer… › « Fusionner et recharger ».

L'import FUSIONNE : rien n'est supprimé, et relancer le script puis réimporter met les positions à jour (identifiants stables).
Le fichier produit contient vos quantités : supprimez-le après l'import. Rien n'est envoyé nulle part (seules des requêtes
publiques de prix sont faites vers Binance et Yahoo pour vérifier que les symboles existent).
Prérequis : Python 3.9+ et `pip install openpyxl`.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

import openpyxl

UA = {"User-Agent": "Mozilla/5.0"}
# Ordre de préférence des paires Binance (les paires USDT ont été retirées pour les comptes européens).
QUOTES_PREFEREES = ("USDC", "USDT", "EUR")


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)


def lire_tokens(chemin):
    wb = openpyxl.load_workbook(chemin, data_only=True, read_only=True)
    lignes = list(wb["Cryptos"].iter_rows(values_only=True))[1:]
    lots = []
    for r in lignes:
        sym, qte = r[0], r[1]
        if sym and isinstance(qte, (int, float)) and qte > 0:  # ignore la ligne TOTAL et les lignes vides
            lots.append({"sym": str(sym).strip().upper(), "qte": float(qte), "pamp": r[2], "tp": r[5], "pf": (r[7] or "").strip()})
    return lots


def main():
    # Les noms de fichiers peuvent contenir des caractères que la console Windows (cp1252) ne sait pas afficher.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if len(sys.argv) < 2:
        sys.exit("Usage : python scripts/importer-excel.py classeur.xlsx [sortie.json]")
    chemin = sys.argv[1]
    sortie = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.expanduser("~"), "Downloads", "hune-import.json")
    print(f"Classeur : {chemin}")

    lots = lire_tokens(chemin)
    info = get("https://api.binance.com/api/v3/exchangeInfo?permissions=SPOT")
    paires = {(s["baseAsset"], s["quoteAsset"]): s["symbol"] for s in info["symbols"] if s["status"] == "TRADING"}

    actifs, positions, a_verifier, introuvables = {}, [], [], []
    compteur = {}
    for lot in lots:
        sym = lot["sym"]
        binance = next((paires[(sym, q)] for q in QUOTES_PREFEREES if (sym, q) in paires), None)
        if binance:
            actif = {"source": "binance", "symbole": binance, "nom": f"{sym}/{binance[len(sym):]}", "categorie": "Cryptos"}
        else:
            # Pas sur Binance : on tente Yahoo (SYM-USD) ; ces cours sont à vérifier (un homonyme est possible).
            y = get(f"https://query1.finance.yahoo.com/v8/finance/spark?symbols={sym}-USD&range=1d&interval=1d")
            if f"{sym}-USD" not in y:
                introuvables.append(sym)
                continue
            actif = {"source": "yahoo", "symbole": f"{sym}-USD", "nom": f"{sym} (Yahoo)", "categorie": "Cryptos"}
            if sym not in a_verifier:
                a_verifier.append(sym)
        cle = f'{actif["source"]}:{actif["symbole"]}'
        actifs[cle] = actif
        compteur[sym] = compteur.get(sym, 0) + 1
        pos = {"id": f"xl-{sym}-{compteur[sym]}", "cle": cle, "quantite": lot["qte"]}
        if isinstance(lot["pamp"], (int, float)):
            pos["pamp"] = lot["pamp"]
        if isinstance(lot["tp"], (int, float)):
            pos["objectif"] = lot["tp"]
        if lot["pf"]:
            pos["plateforme"] = lot["pf"].capitalize()
        positions.append(pos)

    # Actions : symboles déjà résolus dans actions.json ; on vérifie qu'ils existent chez Yahoo.
    ici = os.path.dirname(os.path.abspath(__file__))
    fichier_actions = os.path.join(ici, "actions.json")
    categories = ["Cryptos"]
    non_cotees = []
    if os.path.exists(fichier_actions):
        with open(fichier_actions, encoding="utf-8") as f:
            actions = json.load(f)
        for a in actions:
            if a["compte"] not in categories:
                categories.append(a["compte"])
            if a.get("remarque"):
                print(f'  note {a["nom"]} : {a["remarque"]}')
            if not a["symbole"]:
                non_cotees.append(a["nom"])
                continue
            y = get(f'https://query1.finance.yahoo.com/v8/finance/spark?symbols={a["symbole"]}&range=1d&interval=1d')
            if a["symbole"] not in y:
                introuvables.append(a["symbole"])
                continue
            cle = f'yahoo:{a["symbole"]}'
            actifs[cle] = {"source": "yahoo", "symbole": a["symbole"], "nom": a["nom"], "categorie": a["compte"]}
            # Seul le montant en euros est connu : l'application en déduit une quantité estimée au premier prix reçu.
            positions.append({"id": f'{a["compte"].lower()}-{a["symbole"]}', "cle": cle, "montantEur": a["montant"], "plateforme": a["compte"]})
    else:
        print("Pas de scripts/actions.json : seules les cryptos sont importées (voir actions.exemple.json).")

    fichier = {
        "application": "hune",
        "version": 1,
        "exporteLe": datetime.now(timezone.utc).isoformat(),
        "donnees": {"actifs": list(actifs.values()), "categories": categories, "positions": positions},
    }
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump(fichier, f, ensure_ascii=False, indent=2)

    nb_crypto = sum(1 for p in positions if p["id"].startswith("xl-"))
    print(f"\n{len(actifs)} actifs, {len(positions)} positions ({nb_crypto} lots crypto) -> {sortie}")
    if a_verifier:
        print("A verifier (hors Binance, cours Yahoo possiblement d'un homonyme) :", ", ".join(a_verifier))
    if non_cotees:
        print("Non cotees, non importees :", ", ".join(non_cotees))
    if introuvables:
        print("Introuvables, non importes :", ", ".join(introuvables))


if __name__ == "__main__":
    main()
