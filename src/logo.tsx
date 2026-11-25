/** Logo de Hune (même dessin que branding/icone.svg) : trois bougies montantes sur un carré bleu ciel arrondi. */
export function Logo({ taille = 20 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 1024 1024" role="img" aria-label="Hune">
      <rect width="1024" height="1024" rx="232" fill="#cfe2ff" />
      <rect x="258" y="530" width="44" height="270" rx="22" fill="#4f7fe0" />
      <rect x="195" y="590" width="170" height="150" rx="44" fill="#4f7fe0" />
      <rect x="490" y="350" width="44" height="350" rx="22" fill="#4f7fe0" />
      <rect x="427" y="410" width="170" height="200" rx="44" fill="#4f7fe0" />
      <rect x="722" y="190" width="44" height="370" rx="22" fill="#ff9f80" />
      <rect x="659" y="250" width="170" height="230" rx="44" fill="#ff9f80" />
    </svg>
  );
}
