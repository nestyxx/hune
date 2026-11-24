import { describe, expect, it } from "vitest";
import { messageErreur } from "./miseajour";

describe("messageErreur", () => {
  it("traduit l'échec de lecture du fichier de version en message compréhensible", () => {
    expect(messageErreur(new Error("Could not fetch a valid release JSON from the remote"))).toMatch(/Impossible de lire la dernière version/);
    expect(messageErreur("error sending request for url")).toMatch(/Impossible de lire la dernière version/);
  });
  it("signale une signature invalide", () => {
    expect(messageErreur(new Error("The signature verification failed"))).toMatch(/Signature de la mise à jour invalide/);
  });
  it("laisse passer les autres messages tels quels", () => {
    expect(messageErreur(new Error("Disque plein"))).toBe("Disque plein");
  });
});
