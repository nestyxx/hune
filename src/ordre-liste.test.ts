import { describe, expect, it } from "vitest";
import { deplacerActif } from "./ordre-liste";
import type { Actif } from "./donnees/types";

const c = (symbole: string): Actif => ({ source: "binance", symbole, nom: symbole + "/USDC" });
const a = (symbole: string): Actif => ({ source: "yahoo", symbole, nom: symbole });
const cats = ["Cryptos", "Actions"];
const noms = (l: Actif[] | null) => l?.map((x) => x.symbole).join(",");

describe("deplacerActif", () => {
  const ordre = [c("BTCUSDC"), c("ETHUSDC"), c("SOLUSDC"), a("AAPL"), a("MSFT")];

  it("place un actif devant un autre de la même catégorie", () => {
    expect(noms(deplacerActif(ordre, cats, "binance:SOLUSDC", "binance:BTCUSDC", "Cryptos"))).toBe("SOLUSDC,BTCUSDC,ETHUSDC,AAPL,MSFT");
  });
  it("à la fin d'une catégorie quand il n'y a pas d'actif devant", () => {
    expect(noms(deplacerActif(ordre, cats, "binance:BTCUSDC", null, "Cryptos"))).toBe("ETHUSDC,SOLUSDC,BTCUSDC,AAPL,MSFT");
  });
  it("change de catégorie en passant devant un actif d'une autre", () => {
    const r = deplacerActif(ordre, cats, "binance:SOLUSDC", "yahoo:MSFT", "Actions")!;
    expect(noms(r)).toBe("BTCUSDC,ETHUSDC,AAPL,SOLUSDC,MSFT");
    expect(r.find((x) => x.symbole === "SOLUSDC")?.categorie).toBe("Actions");
  });
  it("ne change rien quand l'actif est déjà à cette place", () => {
    expect(deplacerActif(ordre, cats, "binance:BTCUSDC", "binance:ETHUSDC", "Cryptos")).toBeNull();
    expect(deplacerActif(ordre, cats, "binance:SOLUSDC", null, "Cryptos")).toBeNull();
    expect(deplacerActif(ordre, cats, "binance:BTCUSDC", "binance:BTCUSDC", "Cryptos")).toBeNull();
  });
  it("ignore une clé inconnue", () => {
    expect(deplacerActif(ordre, cats, "binance:XXX", null, "Cryptos")).toBeNull();
  });
});
