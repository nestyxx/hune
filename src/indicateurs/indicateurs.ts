/**
 * Indicateurs techniques : fonctions pures sur des tableaux de nombres (clôtures).
 *
 * Convention : chaque fonction renvoie un tableau de la même longueur que l'entrée ; les positions où
 * l'indicateur n'est pas encore calculable (période d'amorçage) valent `null`.
 */

export type Serie = (number | null)[];

/** Moyenne mobile simple (SMA) sur `periode` valeurs. */
export function sma(valeurs: number[], periode: number): Serie {
  const sortie: Serie = new Array(valeurs.length).fill(null);
  let somme = 0;
  for (let i = 0; i < valeurs.length; i++) {
    somme += valeurs[i];
    if (i >= periode) somme -= valeurs[i - periode];
    if (i >= periode - 1) sortie[i] = somme / periode;
  }
  return sortie;
}

/**
 * Moyenne mobile exponentielle (EMA), coefficient 2/(période+1).
 * Amorçage standard : la première valeur est la SMA des `periode` premières valeurs.
 */
export function ema(valeurs: number[], periode: number): Serie {
  const sortie: Serie = new Array(valeurs.length).fill(null);
  if (valeurs.length < periode) return sortie;
  const k = 2 / (periode + 1);
  let precedente = valeurs.slice(0, periode).reduce((a, b) => a + b, 0) / periode;
  sortie[periode - 1] = precedente;
  for (let i = periode; i < valeurs.length; i++) {
    precedente = valeurs[i] * k + precedente * (1 - k);
    sortie[i] = precedente;
  }
  return sortie;
}

/**
 * RSI de Wilder (lissage RMA). Les moyennes de gains et de pertes sont amorcées par la moyenne simple
 * des `periode` premières variations, puis lissées : moy = (moy_préc × (n−1) + valeur) / n.
 * Premier point calculable à l'indice `periode`.
 */
export function rsi(valeurs: number[], periode = 14): Serie {
  const sortie: Serie = new Array(valeurs.length).fill(null);
  if (valeurs.length <= periode) return sortie;

  let gains = 0;
  let pertes = 0;
  for (let i = 1; i <= periode; i++) {
    const d = valeurs[i] - valeurs[i - 1];
    if (d >= 0) gains += d;
    else pertes -= d;
  }
  let moyGain = gains / periode;
  let moyPerte = pertes / periode;
  sortie[periode] = versRsi(moyGain, moyPerte);

  for (let i = periode + 1; i < valeurs.length; i++) {
    const d = valeurs[i] - valeurs[i - 1];
    moyGain = (moyGain * (periode - 1) + Math.max(d, 0)) / periode;
    moyPerte = (moyPerte * (periode - 1) + Math.max(-d, 0)) / periode;
    sortie[i] = versRsi(moyGain, moyPerte);
  }
  return sortie;
}

function versRsi(moyGain: number, moyPerte: number): number {
  if (moyPerte === 0) return moyGain === 0 ? 50 : 100; // marché plat : neutre
  return 100 - 100 / (1 + moyGain / moyPerte);
}

export interface ResultatMacd {
  macd: Serie;
  signal: Serie;
  histogramme: Serie;
}

/** MACD = EMA(rapide) − EMA(lente) ; signal = EMA(signal) du MACD ; histogramme = MACD − signal. */
export function macd(valeurs: number[], rapide = 12, lente = 26, signal = 9): ResultatMacd {
  const emaRapide = ema(valeurs, rapide);
  const emaLente = ema(valeurs, lente);
  const ligne: Serie = valeurs.map((_, i) => (emaRapide[i] != null && emaLente[i] != null ? emaRapide[i]! - emaLente[i]! : null));

  // La EMA du signal ne porte que sur la partie définie de la ligne MACD.
  const debut = ligne.findIndex((v) => v != null);
  const sig: Serie = new Array(valeurs.length).fill(null);
  if (debut >= 0) {
    const emaSignal = ema(ligne.slice(debut) as number[], signal);
    emaSignal.forEach((v, i) => (sig[debut + i] = v));
  }
  const histogramme: Serie = ligne.map((v, i) => (v != null && sig[i] != null ? v - sig[i]! : null));
  return { macd: ligne, signal: sig, histogramme };
}

export interface ResultatBollinger {
  milieu: Serie;
  haut: Serie;
  bas: Serie;
}

/** Bandes de Bollinger : SMA ± `ecarts` × écart-type (population, comme TradingView). */
export function bollinger(valeurs: number[], periode = 20, ecarts = 2): ResultatBollinger {
  const milieu = sma(valeurs, periode);
  const haut: Serie = new Array(valeurs.length).fill(null);
  const bas: Serie = new Array(valeurs.length).fill(null);
  for (let i = periode - 1; i < valeurs.length; i++) {
    const m = milieu[i]!;
    let somme = 0;
    for (let j = i - periode + 1; j <= i; j++) somme += (valeurs[j] - m) ** 2;
    const sigma = Math.sqrt(somme / periode);
    haut[i] = m + ecarts * sigma;
    bas[i] = m - ecarts * sigma;
  }
  return { milieu, haut, bas };
}

export interface ResultatStochastique {
  k: Serie;
  d: Serie;
}

/**
 * Oscillateur stochastique : %K brut = (clôture − plus bas) / (plus haut − plus bas) × 100 sur `periodeK` bougies,
 * lissé par une SMA de `lissageK` (« stochastique lent »), puis %D = SMA de `periodeD` sur %K.
 * Un marché sans amplitude (plus haut = plus bas) vaut 50.
 */
export function stochastique(hauts: number[], bas: number[], clotures: number[], periodeK = 14, lissageK = 3, periodeD = 3): ResultatStochastique {
  const n = clotures.length;
  const brut: number[] = [];
  for (let i = periodeK - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - periodeK + 1; j <= i; j++) {
      hh = Math.max(hh, hauts[j]);
      ll = Math.min(ll, bas[j]);
    }
    brut.push(hh === ll ? 50 : ((clotures[i] - ll) / (hh - ll)) * 100);
  }
  const placer = (valeurs: Serie, decalage: number): Serie => {
    const sortie: Serie = new Array(n).fill(null);
    valeurs.forEach((v, i) => (sortie[decalage + i] = v));
    return sortie;
  };
  const kLisse = sma(brut, lissageK); // défini à partir de lissageK − 1 dans `brut`
  const premier = kLisse.findIndex((v) => v != null);
  const k = premier < 0 ? new Array(n).fill(null) : placer(kLisse, periodeK - 1);
  const d: Serie = new Array(n).fill(null);
  if (premier >= 0) {
    const dLisse = sma(kLisse.slice(premier) as number[], periodeD);
    dLisse.forEach((v, i) => (d[periodeK - 1 + premier + i] = v));
  }
  return { k, d };
}
