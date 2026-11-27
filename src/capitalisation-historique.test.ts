import { describe, expect, it } from "vitest";
import { ajouterPoint, valeurIlYa, type PointCapitalisation } from "./capitalisation-historique";
import type { Capitalisation } from "./donnees/capitalisation";
import { formaterGrosMontant } from "./capitalisation-marche";

const cap = (total: number): Capitalisation => ({ total, dominanceBtc: 58, dominanceEth: 10, total2: total * 0.42, total3: total * 0.32, variation24h: null, majLe: 0 });
const H = 3600_000;

describe("historique de la capitalisation", () => {
  it("n'ajoute un point que tous les 15 minutes", () => {
    const a = ajouterPoint([], cap(100), 0);
    expect(a).toHaveLength(1);
    expect(ajouterPoint(a, cap(101), 10 * 60_000)).toBe(a);
    expect(ajouterPoint(a, cap(101), 16 * 60_000)).toHaveLength(2);
  });
  it("oublie les points de plus de 30 jours", () => {
    const vieux: PointCapitalisation[] = [{ temps: 0, total: 1, dominanceBtc: 1, total2: 1, total3: 1 }];
    const r = ajouterPoint(vieux, cap(100), 31 * 24 * H);
    expect(r).toHaveLength(1);
    expect(r[0].total).toBe(100);
  });
  it("donne la valeur d'il y a 24 h seulement si l'historique remonte assez loin", () => {
    let h: PointCapitalisation[] = [];
    h = ajouterPoint(h, cap(100), 0);
    h = ajouterPoint(h, cap(110), 12 * H);
    expect(valeurIlYa(h, "total", 12 * H, 24 * H)).toBeNull();
    h = ajouterPoint(h, cap(120), 24 * H);
    expect(valeurIlYa(h, "total", 24 * H, 24 * H)).toBe(100);
  });
});

describe("formaterGrosMontant", () => {
  it("écrit les billions et les milliards en français", () => {
    expect(formaterGrosMontant(2.084e12).replace(/\s/g, " ")).toBe("2,08 T$");
    expect(formaterGrosMontant(880e9).replace(/\s/g, " ")).toBe("880 Md$");
    expect(formaterGrosMontant(36.4e9).replace(/\s/g, " ")).toBe("36,4 Md$");
  });
});
