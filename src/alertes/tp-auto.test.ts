import { describe, expect, it } from "vitest";
import type { Actif } from "../donnees/types";
import type { Position } from "../portefeuille";
import type { Alerte } from "./moteur";
import { alertesNiveauxManquantes, alertesTpManquantes, synchroniserAlertesNiveaux, synchroniserAlertesTp } from "./tp-auto";

const actif: Actif = { source: "yahoo", symbole: "TTWO", nom: "Take-Two" };
const cle = "yahoo:TTWO";
const lot = (objectif?: number, id = "l1"): Position => ({ id, cle, quantite: 1, objectif });
const prix = () => 227;
const sync = (avant: Position[], apres: Position[], alertes: Alerte[] = [], p: (c: string) => number | undefined = prix) => synchroniserAlertesTp(avant, apres, alertes, [actif], p, 1000);

describe("alertes TP automatiques", () => {
  it("crée une alerte « prix ≥ objectif » quand on saisit un objectif au-dessus du prix", () => {
    const r = sync([lot()], [lot(250)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ statut: "armee", tpLot: "l1", condition: { type: "prix", sens: "au-dessus", seuil: 250 } });
  });

  it("ne crée rien pour un objectif déjà atteint", () => {
    expect(sync([lot()], [lot(225)])).toHaveLength(0);
  });

  it("remplace l'alerte du lot quand l'objectif change, sans toucher aux autres alertes", () => {
    const manuelle: Alerte = { id: "m", actif, condition: { type: "prix", sens: "en-dessous", seuil: 100 }, statut: "armee", creeeLe: 1 };
    const premiere = sync([lot()], [lot(250)], [manuelle]);
    const seconde = sync([lot(250)], [lot(260)], premiere);
    expect(seconde.map((a) => (a.condition as { seuil: number }).seuil).sort()).toEqual([100, 260]);
  });

  it("retire l'alerte quand l'objectif est effacé ou le lot supprimé", () => {
    const avecAlerte = sync([lot()], [lot(250)]);
    expect(sync([lot(250)], [lot(undefined)], avecAlerte)).toHaveLength(0);
    expect(sync([lot(250)], [], avecAlerte)).toHaveLength(0);
  });

  it("garde une alerte déjà déclenchée et évite le doublon avec une alerte manuelle identique", () => {
    const declenchee: Alerte = { id: "d", actif, condition: { type: "prix", sens: "au-dessus", seuil: 250 }, statut: "declenchee", creeeLe: 1, tpLot: "l1" };
    expect(sync([lot(250)], [lot(260)], [declenchee]).some((a) => a.id === "d")).toBe(true);
    const manuelle: Alerte = { id: "m", actif, condition: { type: "prix", sens: "au-dessus", seuil: 250 }, statut: "armee", creeeLe: 1 };
    expect(sync([lot()], [lot(250)], [manuelle])).toHaveLength(1);
  });

  it("ne fait rien quand l'objectif ne change pas", () => {
    expect(sync([lot(250)], [{ ...lot(250), quantite: 5 }])).toHaveLength(0);
  });

  it("crée l'alerte même si le prix n'est pas encore connu", () => {
    expect(sync([lot()], [lot(250)], [], () => undefined)).toHaveLength(1);
  });
});

describe("alertesTpManquantes", () => {
  const p = (objectif?: number, id = "l1"): Position => ({ id, cle, quantite: 1, objectif });
  const manquantes = (positions: Position[], alertes: Alerte[] = [], ignores = new Set<string>(), prixDe: (c: string) => number | undefined = prix) => alertesTpManquantes(positions, alertes, [actif], prixDe, ignores, 1000);

  it("crée l'alerte des objectifs déjà saisis, encore au-dessus du prix", () => {
    const r = manquantes([p(250), p(225, "l2"), p(undefined, "l3")]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tpLot: "l1", condition: { seuil: 250 } });
  });
  it("n'en crée pas sans prix connu, pour un lot ignoré ou si une alerte existe déjà à ce seuil (même déclenchée)", () => {
    expect(manquantes([p(250)], [], new Set(), () => undefined)).toHaveLength(0);
    expect(manquantes([p(250)], [], new Set(["l1"]))).toHaveLength(0);
    const declenchee: Alerte = { id: "d", actif, condition: { type: "prix", sens: "au-dessus", seuil: 250 }, statut: "declenchee", creeeLe: 1 };
    expect(manquantes([p(250)], [declenchee])).toHaveLength(0);
  });
  it("ne double pas deux lots au même objectif", () => {
    expect(manquantes([p(250), p(250, "l2")])).toHaveLength(1);
  });
});

describe("stop loss automatique", () => {
  const avecStop = (stop?: number, id = "l1"): Position => ({ id, cle, quantite: 1, stop });
  const syncN = (avant: Position[], apres: Position[], alertes: Alerte[] = [], p: (c: string) => number | undefined = prix) => synchroniserAlertesNiveaux(avant, apres, alertes, [actif], p, 1000);

  it("crée une alerte « prix ≤ stop » quand le stop est sous le prix", () => {
    const r = syncN([avecStop()], [avecStop(200)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ statut: "armee", slLot: "l1", condition: { type: "prix", sens: "en-dessous", seuil: 200 } });
    expect(r[0].tpLot).toBeUndefined();
  });

  it("ne crée rien pour un stop déjà franchi", () => {
    expect(syncN([avecStop()], [avecStop(230)])).toHaveLength(0);
  });

  it("suit le stop : remplacé quand il change, retiré quand il est effacé", () => {
    const premiere = syncN([avecStop()], [avecStop(200)]);
    const seconde = syncN([avecStop(200)], [avecStop(190)], premiere);
    expect(seconde.map((a) => (a.condition as { seuil: number }).seuil)).toEqual([190]);
    expect(syncN([avecStop(190)], [avecStop(undefined)], seconde)).toHaveLength(0);
  });

  it("TP et stop d'un même lot créent deux alertes indépendantes", () => {
    const lotComplet: Position = { id: "l1", cle, quantite: 1, objectif: 250, stop: 200 };
    const r = syncN([{ id: "l1", cle, quantite: 1 }], [lotComplet]);
    expect(r.map((a) => a.condition.type === "prix" && a.condition.sens).sort()).toEqual(["au-dessus", "en-dessous"]);
  });

  it("rattrape les stops déjà saisis, sauf ceux que l'utilisateur a supprimés", () => {
    const positions: Position[] = [{ id: "l1", cle, quantite: 1, stop: 200 }, { id: "l2", cle, quantite: 1, stop: 190 }];
    expect(alertesNiveauxManquantes(positions, [], [actif], prix, new Set(["sl:l2"]), 1000).map((a) => a.slLot)).toEqual(["l1"]);
  });
});
