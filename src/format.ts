/** Remplace les espaces insécables (fines ou non) par une espace ordinaire : toutes les polices la dessinent, pas les autres. */
export const espaceOrdinaire = (s: string) => s.replace(/[  ]/g, " ");

/** Montant déjà exprimé dans `devise` (« 1 234 € », « 1 234 $ ») ; « — » s'il est inconnu. */
export const formaterMontant = (v: number | null, devise: "EUR" | "USD", decimales = 0) =>
  v == null ? "—" : espaceOrdinaire(v.toLocaleString("fr-FR", { style: "currency", currency: devise, currencyDisplay: "narrowSymbol", maximumFractionDigits: decimales, minimumFractionDigits: decimales }));

/** Prix avec un nombre de décimales adapté à l'ordre de grandeur (0,00001234 comme 64 250,12). */
export function formaterPrix(p: number | undefined | null): string {
  if (p == null || !Number.isFinite(p)) return "—";
  const decimales = p >= 1000 ? 2 : p >= 1 ? 3 : p >= 0.01 ? 4 : 8;
  return espaceOrdinaire(p.toLocaleString("fr-FR", { minimumFractionDigits: Math.min(decimales, 2), maximumFractionDigits: decimales }));
}

/** Arrondit un prix lu sur le graphique (ex. 59123,4567…) à une précision lisible pour un seuil d'alerte. */
export function arrondirPrix(p: number): number {
  const decimales = p >= 1000 ? 2 : p >= 1 ? 3 : p >= 0.01 ? 5 : 8;
  return Number(p.toFixed(decimales));
}

export function formaterPct(p: number | undefined | null): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return `${p > 0 ? "+" : ""}${p.toFixed(2).replace(".", ",")} %`;
}

export const classePct = (p: number | null | undefined) => (p == null ? "text-doux" : p >= 0 ? "text-hausse" : "text-baisse");
