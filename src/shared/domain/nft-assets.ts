import artDark from "@/assets/home/art-dark.png";
import artOrange from "@/assets/home/art-orange.png";
import artPurple from "@/assets/home/art-purple.png";
import heroArt from "@/assets/home/hero-art.png";

/**
 * Artes locais do Figma por slug canônico. Variantes reusam a arte do título-base.
 * URLs são resolvidas pelo Vite (hash no build); o seed propaga esses caminhos pela API.
 */
export const nftAssets: Readonly<Record<string, string>> = {
  "emerald-ape-042": heroArt,
  "sage-nomad-009": artPurple,
  "neon-vessel-552": artDark,
  "golden-signal-160": artOrange,
  "cosmic-bloom-118": heroArt,
  "violet-nomad-314": artPurple,
  "ivory-baron-088": artDark,
  "golden-beat-207": artOrange,
};

/** Resolve a arte pelo slug canônico usado no seed (`emerald-ape-042`, …). */
export function resolveNftAsset(imageKey: string): string {
  const url = nftAssets[imageKey];
  if (!url) throw new Error(`Sem arte local para ${imageKey}`);
  return url;
}
