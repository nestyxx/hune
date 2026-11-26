import type { Actif } from "./donnees/types";
import { baseCrypto } from "./icones";

/**
 * Liens externes d'un actif. Rien n'est téléchargé : Hune n'ouvre le lien dans le navigateur qu'au clic,
 * et seul le symbole de l'actif figure dans l'adresse.
 */
export interface LienExterne {
  /** Libellé du bouton. */
  libelle: string;
  /** Infobulle : où le lien mène. */
  aide: string;
  url: string;
}

/** Page CoinMarketCap de quelques dizaines de jetons courants (chaque adresse a été vérifiée) ; les autres passent par la recherche CoinGecko. */
const CMC: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", BNB: "bnb", SOL: "solana", XRP: "xrp", ADA: "cardano", DOGE: "dogecoin", TRX: "tron", LINK: "chainlink", DOT: "polkadot-new",
  AVAX: "avalanche", LTC: "litecoin", BCH: "bitcoin-cash", XLM: "stellar", ATOM: "cosmos", UNI: "uniswap", NEAR: "near-protocol", ICP: "internet-computer",
  SHIB: "shiba-inu", PEPE: "pepe", AAVE: "aave", CRV: "curve-dao-token", ETC: "ethereum-classic", GRT: "the-graph", RENDER: "render", RNDR: "render",
  SAND: "the-sandbox", SUI: "sui", VET: "vechain", MINA: "mina", NEXO: "nexo", OSMO: "osmosis", POL: "polygon-ecosystem-token", MATIC: "polygon-ecosystem-token",
  FET: "artificial-superintelligence-alliance", ASI: "artificial-superintelligence-alliance", DYDX: "dydx-chain", EDU: "edu-coin", EGLD: "multiversx-egld",
  ENS: "ethereum-name-service", ETHFI: "ether-fi-ethfi", STRK: "starknet-token", TRB: "tellor", HBAR: "hedera", CRO: "cronos", APT: "aptos", ARB: "arbitrum",
  INJ: "injective", MKR: "maker", ALGO: "algorand", FIL: "filecoin", XMR: "monero", EOS: "eos", XTZ: "tezos", THETA: "theta-network", AXS: "axie-infinity",
  MANA: "decentraland", GALA: "gala", IMX: "immutable-x", LDO: "lido-dao", FTM: "fantom", PYTH: "pyth-network", JUP: "jupiter-ag", BONK: "bonk",
  WIF: "dogwifhat", FLOKI: "floki", COMP: "compound", AR: "arweave", HNT: "helium",
};

/** Liens « actualités » et « fiche » d'un actif : Yahoo Finance pour les titres, Yahoo Finance + CoinMarketCap pour les cryptos. */
export function liensExternes(actif: Pick<Actif, "source" | "symbole" | "nom">): LienExterne[] {
  const base = baseCrypto(actif);
  if (base) {
    const slug = CMC[base];
    return [
      { libelle: "Actualités", aide: `Actualités de ${base} sur Yahoo Finance (s'ouvre dans votre navigateur)`, url: `https://finance.yahoo.com/quote/${encodeURIComponent(base)}-USD/news/` },
      slug
        ? { libelle: "CoinMarketCap", aide: `Fiche de ${base} sur CoinMarketCap (s'ouvre dans votre navigateur)`, url: `https://coinmarketcap.com/currencies/${slug}/` }
        : { libelle: "Fiche du jeton", aide: `Rechercher ${base} sur CoinGecko (s'ouvre dans votre navigateur)`, url: `https://www.coingecko.com/en/search?query=${encodeURIComponent(base)}` },
    ];
  }
  const s = encodeURIComponent(actif.symbole);
  return [
    { libelle: "Actualités", aide: `Actualités de ${actif.symbole} sur Yahoo Finance (s'ouvre dans votre navigateur)`, url: `https://finance.yahoo.com/quote/${s}/news/` },
    { libelle: "Fiche", aide: `Fiche de ${actif.symbole} sur Yahoo Finance (s'ouvre dans votre navigateur)`, url: `https://finance.yahoo.com/quote/${s}/` },
  ];
}
