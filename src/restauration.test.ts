import { describe, expect, it } from "vitest";
import { compter, dateDepuisNom } from "./restauration";

describe("restauration", () => {
  it("lit la date dans le nom d'une copie automatique", () => {
    const d = dateDepuisNom("hune-20261124.json")!;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 11, 24]);
  });
  it("refuse les noms qui ne sont pas des copies automatiques", () => {
    for (const n of ["hune.json", "hune-2026-11-24.json", "x-20261124.json", "hune-20261124.json.bak"]) expect(dateDepuisNom(n), n).toBeNull();
  });
  it("compte les éléments d'une liste, 0 sinon", () => {
    expect(compter([1, 2, 3])).toBe(3);
    expect(compter(undefined)).toBe(0);
    expect(compter("pas une liste")).toBe(0);
  });
});
