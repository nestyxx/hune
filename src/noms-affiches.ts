import type { Actif } from "./donnees/types";

/**
 * Noms et symboles lisibles. Yahoo renvoie des codes techniques pour les indices (« ^FCHI »), les matières premières (« GC=F »)
 * et les devises (« EURUSD=X ») : on les affiche comme sur un courtier (« CAC 40 », « Or », « EUR/USD »).
 */
const NOMS: Record<string, string> = {
  "^FCHI": "CAC 40",
  "^GSPC": "S&P 500",
  "^IXIC": "Nasdaq Composite",
  "^NDX": "Nasdaq 100",
  "^DJI": "Dow Jones",
  "^RUT": "Russell 2000",
  "^GDAXI": "DAX 40",
  "^FTSE": "FTSE 100",
  "^STOXX50E": "Euro Stoxx 50",
  "^STOXX": "STOXX Europe 600",
  "^N225": "Nikkei 225",
  "^HSI": "Hang Seng",
  "^VIX": "VIX (volatilité)",
  "^IBEX": "IBEX 35",
  "^AEX": "AEX",
  "^BFX": "BEL 20",
  "^SSMI": "SMI (Suisse)",
  "GC=F": "Or",
  "SI=F": "Argent",
  "PL=F": "Platine",
  "PA=F": "Palladium",
  "HG=F": "Cuivre",
  "CL=F": "Pétrole WTI",
  "BZ=F": "Pétrole Brent",
  "NG=F": "Gaz naturel",
  "ZW=F": "Blé",
  "ZC=F": "Maïs",
  "KC=F": "Café",
};

/** Symbole affiché : sans le « ^ » des indices, sans le « =F » des matières premières, « EUR/USD » pour « EURUSD=X ». */
export function symboleAffiche(a: Pick<Actif, "source" | "symbole">): string {
  if (a.source !== "yahoo") return a.symbole;
  const s = a.symbole;
  if (s.startsWith("^")) return s.slice(1);
  if (/^[A-Z]{6}=X$/.test(s)) return `${s.slice(0, 3)}/${s.slice(3, 6)}`;
  if (s.endsWith("=F")) return s.slice(0, -2);
  return s;
}

/** Nom lisible connu pour un indice ou une matière première (null sinon : on garde le nom de la source). */
export function nomConnu(a: Pick<Actif, "source" | "symbole">): string | null {
  return a.source === "yahoo" ? (NOMS[a.symbole] ?? null) : null;
}

/** Nature d'un symbole Yahoo, déduite de sa forme : indice, matière première, devise, ou titre (action, ETF). */
export function natureYahoo(a: Pick<Actif, "source" | "symbole">): "indice" | "matiere" | "devise" | "titre" | "crypto" {
  if (a.source !== "yahoo") return "crypto";
  if (a.symbole.startsWith("^")) return "indice";
  if (a.symbole.endsWith("=F")) return "matiere";
  if (a.symbole.endsWith("=X")) return "devise";
  if (/^[A-Z0-9]{2,10}-(USD|EUR)$/.test(a.symbole)) return "crypto";
  return "titre";
}
