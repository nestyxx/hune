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

/** Noms courants de grandes valeurs, quand le nom de la source est long ou peu parlant. */
const NOMS_COURTS: Record<string, string> = {
  "MC.PA": "LVMH",
  "OR.PA": "L'Oréal",
  "AIR.PA": "Airbus",
  "TTE.PA": "TotalEnergies",
  "SAN.PA": "Sanofi",
  "BNP.PA": "BNP Paribas",
  "OVH.PA": "OVHcloud",
  "RMS.PA": "Hermès",
  "KER.PA": "Kering",
  "CS.PA": "AXA",
  "GLE.PA": "Société Générale",
  "ACA.PA": "Crédit Agricole",
  "DG.PA": "Vinci",
  "SU.PA": "Schneider Electric",
  "RI.PA": "Pernod Ricard",
  "RCO.PA": "Rémy Cointreau",
  "HO.PA": "Thales",
  "CAP.PA": "Capgemini",
  "EL.PA": "EssilorLuxottica",
  "AM.PA": "Dassault Aviation",
  "DSY.PA": "Dassault Systèmes",
  "STLAP.PA": "Stellantis",
  "ENGI.PA": "Engie",
  "ORA.PA": "Orange",
  "VIV.PA": "Vivendi",
  "SAF.PA": "Safran",
  "FDJU.PA": "FDJ United",
  "GOOGL": "Alphabet (Google)",
  "GOOG": "Alphabet (Google)",
  "META": "Meta (Facebook)",
  "BRK-B": "Berkshire Hathaway",
};

/** Mots juridiques ou parasites en fin de nom (« XPeng Inc. » → « XPeng »). */
const FIN_JURIDIQUE = /[,\s]+(inc\.?|incorporated|corp\.?|corporation|company|co\.?|ltd\.?|limited|plc|s\.?a\.?s?\.?|se|ag|n\.?v\.?|spa|s\.p\.a\.|ab|asa|oyj|holdings?|group|groupe|pbc|adr|class [a-z])$/i;

/** Nom court et lisible d'un titre : sans forme juridique, sans parenthèse, sans « The » (« The Coca-Cola Company » → « Coca-Cola »). */
export function nomCourt(nom: string, symbole?: string): string {
  if (symbole && NOMS_COURTS[symbole]) return NOMS_COURTS[symbole];
  let s = nom.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    const suite = s.replace(FIN_JURIDIQUE, "").trim();
    if (suite === s || suite.length < 2) break;
    s = suite;
  }
  s = s.replace(/^the\s+/i, "").trim();
  return s || nom;
}

/** Places de cotation d'après le suffixe Yahoo (« .PA » = Euronext Paris). */
const BOURSES: Record<string, { nom: string; court: string }> = {
  PA: { nom: "Euronext Paris", court: "Paris" },
  AS: { nom: "Euronext Amsterdam", court: "Amsterdam" },
  BR: { nom: "Euronext Bruxelles", court: "Bruxelles" },
  LS: { nom: "Euronext Lisbonne", court: "Lisbonne" },
  MI: { nom: "Borsa Italiana (Milan)", court: "Milan" },
  MC: { nom: "Bourse de Madrid", court: "Madrid" },
  DE: { nom: "Xetra (Francfort)", court: "Xetra" },
  F: { nom: "Bourse de Francfort", court: "Francfort" },
  SG: { nom: "Bourse de Stuttgart", court: "Stuttgart" },
  L: { nom: "Bourse de Londres", court: "Londres" },
  SW: { nom: "SIX Swiss Exchange (Zurich)", court: "Zurich" },
  ST: { nom: "Bourse de Stockholm", court: "Stockholm" },
  CO: { nom: "Bourse de Copenhague", court: "Copenhague" },
  OL: { nom: "Bourse d'Oslo", court: "Oslo" },
  HE: { nom: "Bourse d'Helsinki", court: "Helsinki" },
  VI: { nom: "Bourse de Vienne", court: "Vienne" },
  HK: { nom: "Bourse de Hong Kong", court: "Hong Kong" },
  T: { nom: "Bourse de Tokyo", court: "Tokyo" },
  SS: { nom: "Bourse de Shanghai", court: "Shanghai" },
  SZ: { nom: "Bourse de Shenzhen", court: "Shenzhen" },
  KS: { nom: "Bourse de Corée (KOSPI)", court: "Séoul" },
  TO: { nom: "Bourse de Toronto", court: "Toronto" },
  AX: { nom: "Bourse d'Australie (ASX)", court: "Sydney" },
  SI: { nom: "Bourse de Singapour", court: "Singapour" },
  TW: { nom: "Bourse de Taïwan", court: "Taïwan" },
  NS: { nom: "Bourse de Bombay (NSE)", court: "Inde" },
  SA: { nom: "Bourse de São Paulo", court: "São Paulo" },
};

/** Place de cotation d'un symbole Yahoo (null pour les titres américains, sans suffixe, et pour tout ce qui n'est pas un titre). */
export function bourseDe(a: Pick<Actif, "source" | "symbole">): { nom: string; court: string } | null {
  if (natureYahoo(a) !== "titre") return null;
  const m = /\.([A-Z]{1,2})$/.exec(a.symbole);
  return m ? (BOURSES[m[1]] ?? null) : null;
}

/** Deuxième ligne d'un titre : son symbole boursier et sa place (« OVH.PA · Paris »). Null pour tout autre actif. */
export function detailTitre(a: Pick<Actif, "source" | "symbole">): string | null {
  if (natureYahoo(a) !== "titre") return null;
  const b = bourseDe(a);
  return b ? `${a.symbole} · ${b.court}` : a.symbole;
}

/** Libellé principal d'un actif : le nom court d'une action (« XPeng »), le nom courant d'un indice (« CAC 40 »), sinon sans le « ^ », sans le « =F » des matières premières, « EUR/USD » pour « EURUSD=X ». */
/** Noms affichés portés par plusieurs actifs suivis (minuscules) : on y ajoute la place de cotation pour les distinguer. */
let doublons = new Set<string>();
export function declarerActifsSuivis(actifs: (Pick<Actif, "source" | "symbole"> & { nom?: string })[]): void {
  const vus = new Map<string, number>();
  for (const a of actifs) {
    const k = libelleBase(a).toLowerCase();
    vus.set(k, (vus.get(k) ?? 0) + 1);
  }
  const suivant = new Set([...vus].filter(([, c]) => c > 1).map(([k]) => k));
  if (suivant.size !== doublons.size || [...suivant].some((k) => !doublons.has(k))) doublons = suivant;
}

export function symboleAffiche(a: Pick<Actif, "source" | "symbole"> & { nom?: string }): string {
  const base = libelleBase(a);
  if (!doublons.has(base.toLowerCase())) return base;
  const place = natureYahoo(a) === "titre" ? (bourseDe(a)?.court ?? "US") : null;
  return place ? `${base} (${place})` : base;
}

function libelleBase(a: Pick<Actif, "source" | "symbole"> & { nom?: string }): string {
  if (a.source !== "yahoo") return a.symbole;
  const s = a.symbole;
  if (natureYahoo(a) === "titre" && (NOMS_COURTS[s] || (a.nom && a.nom.trim() && a.nom.trim().toUpperCase() !== s.toUpperCase()))) return nomCourt(a.nom ?? s, s);
  if (s.startsWith("^")) return NOMS[s] ?? s.slice(1);
  if (/^[A-Z]{6}=X$/.test(s)) return `${s.slice(0, 3)}/${s.slice(3, 6)}`;
  if (/^[A-Z]{3}=X$/.test(s)) return `USD/${s.slice(0, 3)}`; // « EUR=X » : combien d'euros pour un dollar
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
