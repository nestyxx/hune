import { describe, expect, it, vi } from "vitest";
import { ErreurHttp, ErreurPause, Requeteur } from "./requeteur";

describe("Requeteur", () => {
  it("sert le cache jusqu'à expiration du TTL", async () => {
    let t = 0;
    const r = new Requeteur(() => t);
    const f = vi.fn().mockResolvedValue(1);
    await r.obtenir("a", 1000, f);
    await r.obtenir("a", 1000, f);
    expect(f).toHaveBeenCalledTimes(1);
    t = 1500;
    await r.obtenir("a", 1000, f);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("fusionne les requêtes simultanées identiques", async () => {
    const r = new Requeteur(() => 0);
    const f = vi.fn().mockResolvedValue(7);
    await Promise.all([r.obtenir("a", 1000, f), r.obtenir("a", 1000, f)]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("met la source en pause après une erreur, avec un délai exponentiel", async () => {
    let t = 0;
    const r = new Requeteur(() => t, 2000);
    const ko = vi.fn().mockRejectedValue(new Error("boum"));
    await expect(r.obtenir("a", 1000, ko)).rejects.toThrow("boum");
    // Pendant la pause, on n'appelle même pas la source.
    await expect(r.obtenir("b", 1000, ko)).rejects.toBeInstanceOf(ErreurPause);
    expect(ko).toHaveBeenCalledTimes(1);
    t = 2001; // pause de 2 s terminée
    await expect(r.obtenir("b", 1000, ko)).rejects.toThrow("boum");
    t = 2001 + 3999; // la 2e pause dure 4 s
    await expect(r.obtenir("b", 1000, ko)).rejects.toBeInstanceOf(ErreurPause);
  });

  it("resert la valeur périmée pendant la pause", async () => {
    let t = 0;
    const r = new Requeteur(() => t);
    await r.obtenir("a", 1000, async () => 42);
    t = 2000;
    const valeur = await r.obtenir("a", 1000, async () => {
      throw new Error("x");
    });
    expect(valeur).toBe(42);
  });

  it("pause longue sur rate limit (429)", async () => {
    let t = 0;
    const r = new Requeteur(() => t, 2000);
    await expect(
      r.obtenir("a", 1000, async () => {
        throw new ErreurHttp(429);
      }),
    ).rejects.toBeInstanceOf(ErreurHttp);
    expect(r.enPause).toBe(true);
    t = 30_000; // 2000 * 2^4 = 32 s
    expect(r.enPause).toBe(true);
    t = 33_000;
    expect(r.enPause).toBe(false);
  });
});
