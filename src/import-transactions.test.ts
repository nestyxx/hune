import { describe, expect, it } from "vitest";
import { actifSuivi, analyserCsv, idImport, lireCsv, planifierImport, plateformeDepuisNom, resoudreTokens, synthetiser } from "./import-transactions";
import type { Actif } from "./donnees/types";
import type { Position } from "./portefeuille";

// Données fictives au format d'export CoinMarketCap (du plus récent au plus ancien, séparateur de milliers « , »).
const CMC = `Date (UTC+1:00),Token,Type,Price (EUR),Amount,Total value (EUR),Fee,Fee Currency,Notes
"2025-03-01 10:00:00","AAA","buy","1,200.00","0.5","600.00","1.0000","EUR",""
"2025-02-01 10:00:00","AAA","sell","1,000.00","0.4","400.00","1.0000","EUR",""
"2025-01-10 09:00:00","BBB","buy","2.0000","100","200.00","1.0000","EUR",""
"2025-01-10 09:00:00","MATIC","buy","0.98","200","196.00","1.0000","EUR",""
"2025-01-10 09:00:00","POL","buy","0.98","200","196.00","1.0000","EUR",""
"2025-01-05 09:00:00","CCC","buy","10","1","10.00","0","EUR",""
"2025-01-06 09:00:00","CCC","sell","12","1","12.00","0","EUR",""
"2025-01-01 08:00:00","AAA","buy","800.00","1","800.00","1.0000","EUR",""
"2025-01-02 08:00:00","AAA","transfer","","1","","0","EUR",""
`;

describe("lireCsv", () => {
  it("gère les guillemets, les virgules internes, le BOM et les fins de ligne Windows", () => {
    expect(lireCsv('﻿a,b\r\n"x, y","il dit ""oui"""\r\n')).toEqual([["a", "b"], ["x, y", 'il dit "oui"']]);
  });
  it("détecte le point-virgule", () => {
    expect(lireCsv("a;b\n1,5;2")).toEqual([["a", "b"], ["1,5", "2"]]);
  });
});

describe("analyserCsv", () => {
  const a = analyserCsv(CMC);
  it("reconnaît le format CoinMarketCap et la devise", () => {
    expect(a.format).toBe("CoinMarketCap");
    expect(a.devise).toBe("EUR");
  });
  it("remet les transactions dans l'ordre chronologique et lit les milliers", () => {
    const dates = a.transactions.map((t) => t.date);
    expect([...dates].sort((x, y) => x - y)).toEqual(dates);
    expect(a.transactions.find((t) => t.token === "AAA" && t.sens === "achat" && t.quantite === 0.5)?.total).toBe(600);
  });
  it("ignore les types qui ne sont ni achat ni vente, en le disant", () => {
    expect(a.ignorees).toEqual([{ motif: "type « transfer » (ni achat ni vente)", nombre: 1 }]);
  });
  it("traite MATIC comme POL et retire le doublon exact", () => {
    expect(a.transactions.filter((t) => t.token === "POL")).toHaveLength(1);
    expect(a.transactions.some((t) => t.token === "MATIC")).toBe(false);
    expect(a.avertissements.join(" ")).toMatch(/identique/);
    expect(analyserCsv(CMC, false).transactions.filter((t) => t.token === "POL")).toHaveLength(2);
  });
  it("lit un fichier à virgule décimale et point-virgule", () => {
    const fr = analyserCsv("Date;Symbole;Type;Prix;Quantité;Total\n01/02/2025 10:00;btc;Achat;1 234,50;0,5;617,25\n");
    expect(fr.format).toBe("CSV générique");
    expect(fr.transactions[0]).toMatchObject({ token: "BTC", sens: "achat", quantite: 0.5, total: 617.25 });
  });
  it("calcule le total quand seul le prix est fourni", () => {
    expect(analyserCsv("date,symbol,side,price,quantity\n2025-01-01,eth,BUY,2000,0.25\n").transactions[0].total).toBe(500);
  });
  it("refuse un fichier dont les colonnes sont inconnues", () => {
    expect(() => analyserCsv("foo,bar\n1,2\n")).toThrow(/Colonnes non reconnues/);
    expect(() => analyserCsv("date,token\n")).toThrow(/aucune transaction/);
  });
});

describe("synthetiser", () => {
  const s = synthetiser(analyserCsv(CMC).transactions);
  const ligne = (t: string) => s.lignes.find((l) => l.token === t)!;
  it("calcule quantité et PAMP, frais d'achat inclus ; une vente ne change pas le PAMP", () => {
    // Achat 1 à 800 (+1 de frais), vente 0,4, achat 0,5 à 600 (+1) : reste 1,1 ; coût = 801 × 0,6 + 601.
    expect(ligne("AAA").quantite).toBeCloseTo(1.1, 10);
    expect(ligne("AAA").cout).toBeCloseTo(801 * 0.6 + 601, 8);
    expect(ligne("AAA").pamp).toBeCloseTo((801 * 0.6 + 601) / 1.1, 8);
  });
  it("sépare les tokens entièrement vendus", () => {
    expect(s.soldes).toEqual(["CCC"]);
    expect(s.lignes.map((l) => l.token)).not.toContain("CCC");
  });
  it("plafonne une vente supérieure aux achats connus et le signale", () => {
    const r = synthetiser([
      { date: 1, token: "X", sens: "achat", quantite: 1, total: 10, frais: 0 },
      { date: 2, token: "X", sens: "vente", quantite: 3, total: 30, frais: 0 },
      { date: 3, token: "Y", sens: "vente", quantite: 1, total: 5, frais: 0 },
    ]);
    expect(r.avertissements).toHaveLength(2);
    expect(r.lignes).toEqual([]);
  });
});

describe("plateformeDepuisNom", () => {
  it("déduit un nom lisible", () => {
    expect(plateformeDepuisNom("TRADE_REPUBLIC_with_transaction_history.csv")).toBe("Trade Republic");
    expect(plateformeDepuisNom("kraken-ledger.csv")).toBe("Kraken Ledger");
    expect(plateformeDepuisNom("transactions.csv")).toBe("");
  });
});

describe("résolution et plan d'import", () => {
  const suivis: Actif[] = [{ source: "binance", symbole: "AAAUSDC", nom: "AAA/USDC" }];
  it("préfère un actif déjà suivi, sinon la paire EUR puis USDC puis USDT", async () => {
    expect(actifSuivi("AAA", suivis)?.symbole).toBe("AAAUSDC");
    expect(actifSuivi("AA", suivis)).toBeUndefined();
    const r = await resoudreTokens(["AAA", "BBB", "ZZZ"], {
      actifs: suivis,
      rechercher: async (q) => (q === "BBB" ? ["BBBUSDT", "BBBEUR", "BBBUSDC"].map((s) => ({ source: "binance" as const, symbole: s, nom: `BBB/${s.slice(3)}`, detail: "" })) : []),
      devise: async (a) => (a.symbole.endsWith("EUR") ? "EUR" : "USD"),
    });
    expect(r.get("AAA")).toMatchObject({ existant: true, devise: "USD" });
    expect(r.get("BBB")).toMatchObject({ existant: false, devise: "EUR", actif: { symbole: "BBBEUR" } });
    expect(r.get("ZZZ")).toBeNull();
  });

  it("convertit le PAMP vers la devise de l'actif, remplace les lots de la plateforme et garde l'objectif", async () => {
    const synthese = synthetiser(analyserCsv(CMC).transactions);
    const resol = new Map([
      ["AAA", { actif: suivis[0], existant: true, devise: "USD" }],
      ["BBB", { actif: { source: "binance" as const, symbole: "BBBEUR", nom: "BBB/EUR" }, existant: false, devise: "EUR" }],
    ]);
    const existantes: Position[] = [
      { id: "xl-AAA-1", cle: "binance:AAAUSDC", quantite: 9, plateforme: "trade republic", objectif: 2000 },
      { id: "xl-AAA-2", cle: "binance:AAAUSDC", quantite: 4, plateforme: "Binance" },
    ];
    const plan = planifierImport(synthese, resol, "Trade Republic", "EUR", { EUR: 1, USD: 0.8 }, existantes, suivis);
    const aaa = plan.positions.find((p) => p.cle === "binance:AAAUSDC")!;
    expect(aaa.id).toBe(idImport("Trade Republic", "AAA"));
    expect(aaa.pamp).toBeCloseTo(synthese.lignes.find((l) => l.token === "AAA")!.pamp / 0.8, 8); // EUR → USD
    expect(aaa.objectif).toBe(2000);
    expect(plan.remplacees.map((p) => p.id)).toEqual(["xl-AAA-1"]); // le lot Binance est intact
    expect(plan.actifs.map((a) => a.symbole)).toEqual(["BBBEUR"]);
    expect(plan.positions.find((p) => p.cle === "binance:BBBEUR")!.pamp).toBeCloseTo(2.01, 8);
  });

  it("sans taux de change, importe la quantité sans PAMP plutôt qu'un PAMP faux", () => {
    const synthese = synthetiser(analyserCsv(CMC).transactions);
    const plan = planifierImport(synthese, new Map([["AAA", { actif: suivis[0], existant: true, devise: "USD" }]]), "TR", "EUR", { EUR: 1 }, [], suivis);
    expect(plan.positions[0].pamp).toBeUndefined();
    expect(plan.positions[0].quantite).toBeCloseTo(1.1, 10);
  });
});
