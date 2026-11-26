import { describe, expect, it } from "vitest";
import { chiffrer, dechiffrer, ErreurMotDePasse } from "./chiffrement";

describe("chiffrement du fichier de synchronisation", () => {
  it("restitue le texte avec le bon mot de passe (accents compris)", async () => {
    const c = await chiffrer('{"nom":"Crédit Agricole — 1 000 €"}', "motdepasse");
    expect(c.donnees).not.toContain("Agricole");
    expect(await dechiffrer(c, "motdepasse")).toBe('{"nom":"Crédit Agricole — 1 000 €"}');
  });

  it("refuse un mauvais mot de passe ou un contenu altéré", async () => {
    const c = await chiffrer("secret", "bon");
    await expect(dechiffrer(c, "mauvais")).rejects.toBeInstanceOf(ErreurMotDePasse);
    await expect(dechiffrer({ ...c, donnees: c.donnees.slice(0, -4) + "AAAA" }, "bon")).rejects.toBeInstanceOf(ErreurMotDePasse);
  });

  it("produit un résultat différent à chaque fois (sel et vecteur aléatoires)", async () => {
    const a = await chiffrer("x", "m");
    const b = await chiffrer("x", "m");
    expect(a.donnees).not.toBe(b.donnees);
    expect(a.sel).not.toBe(b.sel);
  });
});
