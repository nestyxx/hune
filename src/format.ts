/** Prix avec un nombre de décimales adapté à l'ordre de grandeur (0,00001234 comme 64 250,12). */
export function formaterPrix(p: number | undefined | null): string {
  if (p == null || !Number.isFinite(p)) return "—";
  const decimales = p >= 1000 ? 2 : p >= 1 ? 3 : p >= 0.01 ? 4 : 8;
  return p.toLocaleString("fr-FR", { minimumFractionDigits: Math.min(decimales, 2), maximumFractionDigits: decimales });
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
