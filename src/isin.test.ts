import { describe, expect, it } from "vitest";
import { chercherIsinWikidata, estIsinValide } from "./isin";

const reponse = (isins: string[]) =>
  (async () => ({ ok: true, json: async () => ({ results: { bindings: isins.map((value) => ({ isin: { value } })) } }) })) as unknown as typeof fetch;

describe("ISIN", () => {
  it("valide la forme et la clé de contrôle", () => {
    for (const bon of ["US0378331005", "FR0000121014", "FR0014005HJ9"]) expect(estIsinValide(bon)).toBe(true);
    for (const mauvais of ["US0378331006", "NET000AXPEN7", "fr0000121014", "FR000012101", ""]) expect(estIsinValide(mauvais)).toBe(false);
  });
  it("retient un seul ISIN valide dont le pays correspond à la place", () => {
    return Promise.all([
      chercherIsinWikidata("OVH.PA", reponse(["FR0014005HJ9"])).then((r) => expect(r).toBe("FR0014005HJ9")),
      chercherIsinWikidata("9868.HK", reponse(["NET000AXPEN7"])).then((r) => expect(r).toBeNull()), // clé invalide
      chercherIsinWikidata("MC.PA", reponse(["FR0000121014", "US0378331005"])).then((r) => expect(r).toBe("FR0000121014")), // l'américain est écarté
      chercherIsinWikidata("XX.PA", reponse(["FR0000121014", "FR0014005HJ9"])).then((r) => expect(r).toBeNull()), // ambigu : rien plutôt qu'un doute
    ]);
  });
});
