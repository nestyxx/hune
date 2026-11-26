import { describe, expect, it } from "vitest";
import { canonique, fusionnerDictionnaireDeListes, fusionnerListe, memeValeur } from "./fusion";

type E = { id: string; v?: number };
const e = (id: string, v?: number): E => ({ id, v });
const cle = (x: E) => x.id;
const f = (base: E[], local: E[], distant: E[], prefere: "local" | "distant" = "distant") => fusionnerListe(base, local, distant, cle, prefere);
const ids = (l: E[]) => l.map((x) => x.id).join(",");

describe("canonique / memeValeur", () => {
  it("ignore l'ordre des clés et les valeurs absentes", () => {
    expect(memeValeur({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1, z: undefined })).toBe(true);
    expect(memeValeur({ a: 1 }, { a: 2 })).toBe(false);
    expect(canonique([1, "x"])).toBe('[1,"x"]');
  });
});

describe("fusionnerListe", () => {
  it("garde ce qui n'a pas bougé et combine les ajouts des deux côtés", () => {
    const base = [e("a"), e("b")];
    expect(ids(f(base, [...base, e("c")], [...base, e("d")]))).toBe("a,b,c,d");
  });

  it("prend la modification d'un seul côté", () => {
    const base = [e("a", 1)];
    expect(f(base, [e("a", 2)], base)).toEqual([e("a", 2)]);
    expect(f(base, base, [e("a", 3)])).toEqual([e("a", 3)]);
  });

  it("propage une suppression faite d'un seul côté", () => {
    const base = [e("a"), e("b")];
    expect(ids(f(base, [e("a")], base))).toBe("a");
    expect(ids(f(base, base, [e("b")]))).toBe("b");
  });

  it("une modification l'emporte sur une suppression de l'autre côté", () => {
    const base = [e("a", 1), e("b")];
    expect(f(base, [e("b")], [e("a", 9), e("b")]).find((x) => x.id === "a")).toEqual(e("a", 9));
    expect(f(base, [e("a", 9), e("b")], [e("b")]).find((x) => x.id === "a")).toEqual(e("a", 9));
  });

  it("modifié des deux côtés : le côté le plus récent gagne", () => {
    const base = [e("a", 1)];
    expect(f(base, [e("a", 2)], [e("a", 3)], "local")).toEqual([e("a", 2)]);
    expect(f(base, [e("a", 2)], [e("a", 3)], "distant")).toEqual([e("a", 3)]);
  });

  it("suit l'ordre de celui qui l'a changé", () => {
    const base = [e("a"), e("b"), e("c")];
    expect(ids(f(base, [e("c"), e("a"), e("b")], base))).toBe("c,a,b");
    expect(ids(f(base, base, [e("b"), e("c"), e("a")]))).toBe("b,c,a");
  });

  it("insère un nouvel élément de l'autre côté après son voisin", () => {
    const base = [e("a"), e("b")];
    expect(ids(f(base, [e("b"), e("a")], [e("a"), e("x"), e("b")]))).toBe("b,a,x");
  });

  it("sans base (première synchronisation) : union, le plus récent gagne en cas de désaccord", () => {
    expect(ids(f([], [e("a", 1)], [e("a", 2), e("b")], "local"))).toBe("a,b");
    expect(f([], [e("a", 1)], [e("a", 2)], "distant")).toEqual([e("a", 2)]);
  });

  it("deux appareils identiques ne changent rien", () => {
    const l = [e("a", 1), e("b", 2)];
    expect(f(l, l, l)).toEqual(l);
  });
});

describe("fusionnerDictionnaireDeListes", () => {
  it("fusionne chaque liste et retire les vides", () => {
    const r = fusionnerDictionnaireDeListes({ x: [e("1")], y: [e("2")] }, { x: [e("1"), e("3")], y: [] }, { x: [e("1")], y: [e("2")], z: [e("4")] }, cle, "distant");
    expect(Object.keys(r).sort()).toEqual(["x", "z"]);
    expect(ids(r.x)).toBe("1,3");
  });
});
