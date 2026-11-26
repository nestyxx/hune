import { fournisseur } from "./index";

/**
 * Taux de conversion vers l'euro pour des devises ISO (EUR = 1). Les paires `USDEUR=X`… viennent de Yahoo.
 * « GBp » (pence, cotation de la Bourse de Londres) = GBP / 100. Une devise dont le taux est introuvable est absente
 * du résultat : l'appelant doit alors afficher « — » plutôt qu'un total faux.
 * Si Yahoo ne répond pas, le dollar se déduit quand même de la paire EUR/USDC de Binance (l'USDC est indexé sur l'USD).
 */
export async function tauxVersEur(devises: string[]): Promise<Record<string, number>> {
  const taux: Record<string, number> = { EUR: 1 };
  const bases = [...new Set(devises.map((d) => (d === "GBp" ? "GBP" : d)).filter((d) => d !== "EUR"))];
  if (bases.length) {
    try {
      const cotes = await fournisseur("yahoo").cotations(bases.map((d) => `${d}EUR=X`));
      for (const c of cotes) taux[c.symbole.replace("EUR=X", "")] = c.prix;
    } catch {
      /* Yahoo indisponible ou limité : on tente le repli ci-dessous, les autres devises resteront absentes */
    }
    if (bases.includes("USD") && taux.USD == null) {
      const prixEur = await fournisseur("binance").cotations(["EURUSDC"]).then((c) => c[0]?.prix).catch(() => undefined);
      if (prixEur) taux.USD = 1 / prixEur;
    }
  }
  if (taux.GBP != null) taux.GBp = taux.GBP / 100;
  return taux;
}
