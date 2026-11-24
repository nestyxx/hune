import { describe, expect, it } from "vitest";
import { fusionner, lireSauvegarde } from "./sauvegarde";

const base = { application: "hune", version: 1, exporteLe: "2026-11-24T10:00:00Z" };
const actif = { source: "binance", symbole: "BTCUSDT", nom: "BTC/USDT" };

describe("lireSauvegarde", () => {
  it("accepte une sauvegarde valide et ne garde que les clés connues", () => {
    const d = lireSauvegarde(JSON.stringify({ ...base, donnees: { actifs: [actif], categories: ["Cryptos"], inconnue: 1 } }));
    expect(Object.keys(d).sort()).toEqual(["actifs", "categories"]);
  });
  it("refuse du JSON invalide, un autre fichier, une autre version", () => {
    expect(() => lireSauvegarde("pas du json")).toThrow(/JSON/);
    expect(() => lireSauvegarde(JSON.stringify({ foo: 1 }))).toThrow(/pas une sauvegarde/);
    expect(() => lireSauvegarde(JSON.stringify({ ...base, version: 9, donnees: {} }))).toThrow(/Version/);
  });
  it("refuse des actifs ou des alertes mal formés", () => {
    expect(() => lireSauvegarde(JSON.stringify({ ...base, donnees: { actifs: [{ source: "autre", symbole: "X", nom: "X" }] } }))).toThrow(/actifs/);
    expect(() => lireSauvegarde(JSON.stringify({ ...base, donnees: { alertes: [{ id: "1", actif, condition: { type: "magie" }, statut: "armee" }] } }))).toThrow(/alertes/);
  });
  it("accepte une alerte correcte", () => {
    const alerte = { id: "1", actif, condition: { type: "prix", sens: "au-dessus", seuil: 1 }, statut: "armee", creeeLe: 0 };
    expect(lireSauvegarde(JSON.stringify({ ...base, donnees: { alertes: [alerte] } })).alertes).toHaveLength(1);
  });
});

describe("fusionner", () => {
  const btc = { source: "binance", symbole: "BTCUSDC", nom: "BTC/USDC" };
  const nvda = { source: "yahoo", symbole: "NVDA", nom: "NVIDIA" };
  it("ajoute les actifs importés sans supprimer les actuels, et met à jour la catégorie d'un actif déjà suivi", () => {
    const r = fusionner({ actifs: [btc, nvda] }, { actifs: [{ ...nvda, categorie: "CTO" }, { source: "yahoo", symbole: "MC.PA", nom: "LVMH", categorie: "CTO" }] });
    const actifs = r.actifs as Record<string, unknown>[];
    expect(actifs.map((a) => a.symbole)).toEqual(["BTCUSDC", "NVDA", "MC.PA"]);
    expect(actifs.find((a) => a.symbole === "NVDA")!.categorie).toBe("CTO");
  });
  it("fusionne les catégories en gardant l'ordre actuel", () => {
    expect(fusionner({ categories: ["Cryptos", "Actions"] }, { categories: ["CTO", "Cryptos", "PEA"] }).categories).toEqual(["Cryptos", "Actions", "CTO", "PEA"]);
  });
  it("met à jour les positions par identifiant (réimport sans doublon)", () => {
    const r1 = fusionner({ positions: [{ id: "a", cle: "x", quantite: 1 }] }, { positions: [{ id: "a", cle: "x", quantite: 5 }, { id: "b", cle: "y", quantite: 2 }] });
    expect(r1.positions).toEqual([{ id: "a", cle: "x", quantite: 5 }, { id: "b", cle: "y", quantite: 2 }]);
  });
  it("conserve les alertes et réglages actuels, et ne comble que ce qui manque", () => {
    const al = { id: "1", actif: btc, condition: { type: "prix" }, statut: "armee" };
    const r = fusionner({ alertes: [al], reglages: { theme: "clair" } }, { alertes: [], reglages: { theme: "sombre" }, tri: "symbole" });
    expect(r.alertes).toEqual([al]);
    expect(r.reglages).toEqual({ theme: "clair" });
    expect(r.tri).toBe("symbole");
  });
  it("refuse une position invalide dans le fichier", () => {
    expect(() => lireSauvegarde(JSON.stringify({ application: "hune", version: 1, donnees: { positions: [{ id: "1", cle: "x", quantite: -3 }] } }))).toThrow(/positions/);
  });
});

describe("compatibilité des anciennes sauvegardes", () => {
  it("accepte une sauvegarde créée sous l'ancien nom de l'application", () => {
    const d = lireSauvegarde(JSON.stringify({ application: "suivi-marches", version: 1, donnees: { categories: ["Cryptos"] } }));
    expect(d.categories).toEqual(["Cryptos"]);
  });
});
