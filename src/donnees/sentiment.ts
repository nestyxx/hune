/** Indice « Fear & Greed » du marché crypto (alternative.me, API publique sans clé, CORS ouvert). */
export interface PointSentiment {
  valeur: number;
  /** Secondes Unix (minuit UTC du jour concerné). */
  temps: number;
}

export const libelleSentiment = (v: number) => (v < 25 ? "Peur extrême" : v < 45 ? "Peur" : v <= 55 ? "Neutre" : v < 75 ? "Avidité" : "Avidité extrême");

/** Derniers jours de l'indice, du plus ancien au plus récent. */
export async function chargerSentiment(jours = 14): Promise<PointSentiment[]> {
  const rep = await fetch(`https://api.alternative.me/fng/?limit=${jours}`);
  if (!rep.ok) throw new Error(`alternative.me : HTTP ${rep.status}`);
  const json = (await rep.json()) as { data?: { value: string; timestamp: string }[] };
  return (json.data ?? []).map((d) => ({ valeur: Number(d.value), temps: Number(d.timestamp) })).reverse();
}
