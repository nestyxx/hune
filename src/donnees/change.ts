import { fournisseur } from "./index";

/**
 * Taux de conversion vers l'euro pour des devises ISO (EUR = 1). Les paires `USDEUR=X`… viennent de Yahoo.
 * « GBp » (pence, cotation de la Bourse de Londres) = GBP / 100. Une devise dont le taux est introuvable est absente
 * du résultat : l'appelant doit alors afficher « — » plutôt qu'un total faux.
 */
export async function tauxVersEur(devises: string[]): Promise<Record<string, number>> {
  const taux: Record<string, number> = { EUR: 1 };
  const bases = [...new Set(devises.map((d) => (d === "GBp" ? "GBP" : d)).filter((d) => d !== "EUR"))];
  if (bases.length) {
    const cotes = await fournisseur("yahoo").cotations(bases.map((d) => `${d}EUR=X`));
    for (const c of cotes) taux[c.symbole.replace("EUR=X", "")] = c.prix;
  }
  if (taux.GBP != null) taux.GBp = taux.GBP / 100;
  return taux;
}
