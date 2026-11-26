import { describe, expect, it } from "vitest";
import type { Actif } from "../donnees/types";
import type { Position } from "../portefeuille";
import { ErreurMotDePasse } from "./chiffrement";
import { ETAT_VIDE, ErreurSync, synchroniser, type EntreesSync, type EtatSync } from "./moteur";

const actif = (s: string): Actif => ({ source: "binance", symbole: s, nom: `${s.slice(0, 3)}/USDC` });
const etat = (partiel: Partial<EtatSync>): EtatSync => ({ ...ETAT_VIDE, ...partiel });
const pos = (id: string, objectif?: number): Position => ({ id, cle: "binance:BTCUSDC", quantite: 1, objectif });

/** Un « Drive » partagé et des appareils qui y synchronisent. */
function drive() {
  let contenu: string | null = null;
  const io: EntreesSync = { lire: async () => contenu, ecrire: async (c) => void (contenu = c) };
  return { io, lireBrut: () => contenu, mettre: (c: string | null) => void (contenu = c) };
}
function appareil(nom: string, d: ReturnType<typeof drive>, motDePasse = "") {
  let local = ETAT_VIDE;
  let base: EtatSync | null = null;
  let modifie = 0;
  let horloge = 1000;
  return {
    set: (e: EtatSync, t: number) => {
      local = e;
      modifie = t;
    },
    get etat() {
      return local;
    },
    async sync(maintenant: number) {
      horloge = maintenant;
      const r = await synchroniser(d.io, { local, base, appareil: nom, modifieLocalLe: modifie, motDePasse, maintenant: horloge });
      base = r.etat;
      if (r.appliquer) local = r.etat;
      return r;
    },
  };
}

describe("synchroniser", () => {
  it("la première synchronisation écrit l'état local dans un dossier vide", async () => {
    const d = drive();
    const a = appareil("A", d);
    a.set(etat({ actifs: [actif("BTCUSDC")] }), 1);
    const r = await a.sync(10);
    expect(r.ecrit).toBe(true);
    expect(JSON.parse(d.lireBrut()!).etat.actifs).toHaveLength(1);
  });

  it("un second appareil reçoit les données du premier", async () => {
    const d = drive();
    const a = appareil("A", d);
    const b = appareil("B", d);
    a.set(etat({ actifs: [actif("BTCUSDC")], positions: [pos("p1", 100)] }), 1);
    await a.sync(10);
    const r = await b.sync(20);
    expect(r.appliquer).toBe(true);
    expect(b.etat.actifs.map((x) => x.symbole)).toEqual(["BTCUSDC"]);
    expect(b.etat.positions[0].objectif).toBe(100);
  });

  it("deux appareils convergent vers le même état après des modifications croisées", async () => {
    const d = drive();
    const a = appareil("A", d);
    const b = appareil("B", d);
    a.set(etat({ actifs: [actif("BTCUSDC")], positions: [pos("p1", 100)] }), 1);
    await a.sync(10);
    await b.sync(20);
    // A ajoute un actif et change l'objectif, B ajoute une position et un autre actif.
    a.set(etat({ actifs: [...a.etat.actifs, actif("ETHUSDC")], positions: [pos("p1", 120)] }), 30);
    b.set(etat({ actifs: [...b.etat.actifs, actif("SOLUSDC")], positions: [...b.etat.positions, pos("p2")] }), 31);
    await a.sync(40);
    await b.sync(50);
    await a.sync(60);
    expect(a.etat).toEqual(b.etat);
    expect(a.etat.actifs.map((x) => x.symbole).sort()).toEqual(["BTCUSDC", "ETHUSDC", "SOLUSDC"]);
    expect(a.etat.positions.find((p) => p.id === "p1")?.objectif).toBe(120);
    expect(a.etat.positions.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("une suppression sur un appareil se propage à l'autre", async () => {
    const d = drive();
    const a = appareil("A", d);
    const b = appareil("B", d);
    a.set(etat({ actifs: [actif("BTCUSDC"), actif("ETHUSDC")] }), 1);
    await a.sync(10);
    await b.sync(20);
    b.set(etat({ actifs: [actif("BTCUSDC")] }), 30);
    await b.sync(40);
    await a.sync(50);
    expect(a.etat.actifs.map((x) => x.symbole)).toEqual(["BTCUSDC"]);
  });

  it("n'écrit rien quand rien n'a changé", async () => {
    const d = drive();
    const a = appareil("A", d);
    a.set(etat({ actifs: [actif("BTCUSDC")] }), 1);
    await a.sync(10);
    const r = await a.sync(20);
    expect(r.ecrit).toBe(false);
    expect(r.appliquer).toBe(false);
  });

  it("refuse de propager un état local vide alors que l'appareil avait des données", async () => {
    const d = drive();
    const a = appareil("A", d);
    a.set(etat({ actifs: [actif("BTCUSDC")] }), 1);
    await a.sync(10);
    a.set(ETAT_VIDE, 20);
    await expect(a.sync(30)).rejects.toBeInstanceOf(ErreurSync);
    expect(JSON.parse(d.lireBrut()!).etat.actifs).toHaveLength(1);
  });

  it("chiffre le fichier avec un mot de passe et exige le même ailleurs", async () => {
    const d = drive();
    const a = appareil("A", d, "secret");
    a.set(etat({ actifs: [actif("BTCUSDC")], positions: [pos("p1", 100)] }), 1);
    await a.sync(10);
    expect(d.lireBrut()).not.toContain("BTCUSDC");
    await expect(appareil("B", d, "").sync(20)).rejects.toBeInstanceOf(ErreurSync);
    await expect(appareil("C", d, "faux").sync(20)).rejects.toBeInstanceOf(ErreurMotDePasse);
    const b = appareil("D", d, "secret");
    await b.sync(30);
    expect(b.etat.positions[0].objectif).toBe(100);
  });

  it("rejette un fichier qui n'est pas de Hune", async () => {
    const d = drive();
    d.mettre('{"autre":1}');
    await expect(appareil("A", d).sync(1)).rejects.toBeInstanceOf(ErreurSync);
    d.mettre("pas du json");
    await expect(appareil("A", d).sync(2)).rejects.toBeInstanceOf(ErreurSync);
  });

  it("garde les alertes déclenchées d'un côté et réarmées de l'autre selon le plus récent", async () => {
    const d = drive();
    const a = appareil("A", d);
    const b = appareil("B", d);
    const alerte = { id: "al1", actif: actif("BTCUSDC"), condition: { type: "prix" as const, sens: "au-dessus" as const, seuil: 100 }, statut: "armee" as const, creeeLe: 1 };
    a.set(etat({ actifs: [actif("BTCUSDC")], alertes: [alerte] }), 1);
    await a.sync(10);
    await b.sync(20);
    a.set(etat({ actifs: a.etat.actifs, alertes: [{ ...alerte, statut: "declenchee", declencheeLe: 25 }] }), 25);
    await a.sync(26);
    await b.sync(30);
    expect(b.etat.alertes[0].statut).toBe("declenchee");
  });
});
