/** Forme d'un ISIN : 2 lettres (pays), 9 caractères alphanumériques, 1 chiffre de contrôle. */
const FORME_ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

/** Vrai si la saisie ressemble à un ISIN (sans vérifier la clé). */
export const ressembleAIsin = (saisie: string) => FORME_ISIN.test(saisie.trim().toUpperCase());

/**
 * Valide la clé de contrôle d'un ISIN (algorithme de Luhn après conversion des lettres en nombres A=10 … Z=35).
 * Permet de refuser tout de suite une faute de frappe sans interroger l'API.
 */
export function isinValide(saisie: string): boolean {
  const isin = saisie.trim().toUpperCase();
  if (!FORME_ISIN.test(isin)) return false;
  const chiffres = [...isin].map((c) => (c >= "A" && c <= "Z" ? String(c.charCodeAt(0) - 55) : c)).join("");
  let somme = 0;
  // Luhn : on double un chiffre sur deux en partant de la droite (le dernier chiffre n'est pas doublé).
  for (let i = 0; i < chiffres.length; i++) {
    let n = Number(chiffres[chiffres.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}
