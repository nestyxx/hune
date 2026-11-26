import { describe, expect, it } from "vitest";
import { actualiteNouvelle, actualitesPertinentes, nombreNouvelles } from "./actualites";

const brute = (titre: string, date: number, tickers: string[]) => ({ title: titre, publisher: "Éditeur", providerPublishTime: date, link: "https://exemple.test/" + date, relatedTickers: tickers });

describe("actualitesPertinentes", () => {
  it("ne garde que les articles qui citent le symbole, du plus récent au plus ancien", () => {
    const r = actualitesPertinentes([brute("ancien", 100, ["TTWO"]), brute("hors sujet", 300, ["AAPL"]), brute("récent", 200, ["GME", "TTWO"])], "TTWO");
    expect(r.map((a) => a.titre)).toEqual(["récent", "ancien"]);
  });
  it("ignore les entrées sans titre ou sans date", () => {
    expect(actualitesPertinentes([{ relatedTickers: ["X"] }, { title: "t", relatedTickers: ["X"] }], "X")).toEqual([]);
  });
});

describe("actualiteNouvelle", () => {
  const maintenant = 1_000_000 * 1000;
  const actus = [{ titre: "t", editeur: "e", date: 1_000_000 - 3600, lien: "" }];
  it("signale une actualité de moins de 24 h jamais consultée", () => {
    expect(actualiteNouvelle(actus, 0, maintenant)?.titre).toBe("t");
  });
  it("n'en signale plus après consultation", () => {
    expect(actualiteNouvelle(actus, maintenant - 60_000, maintenant)).toBeNull();
  });
  it("ignore une actualité plus ancienne que le délai", () => {
    expect(actualiteNouvelle([{ ...actus[0], date: 1_000_000 - 3 * 24 * 3600 }], 0, maintenant)).toBeNull();
  });
  it("rien sans actualité", () => {
    expect(actualiteNouvelle([], 0, maintenant)).toBeNull();
  });
});

describe("nombreNouvelles", () => {
  const maintenant = 1_000_000 * 1000;
  const a = (ageH: number) => ({ titre: "t", editeur: "e", date: 1_000_000 - ageH * 3600, lien: "" });
  it("compte les articles de moins de 24 h publiés après la dernière consultation", () => {
    expect(nombreNouvelles([a(1), a(5), a(30)], 0, maintenant)).toBe(2);
    expect(nombreNouvelles([a(1), a(5), a(30)], maintenant - 2 * 3600 * 1000, maintenant)).toBe(1);
  });
});
