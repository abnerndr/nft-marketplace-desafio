import { mulEth } from "@/shared/domain/money";
import { getDatabase, saveDatabase } from "./db";

/** Versão atual do preço de um NFT. Sem mudança registrada vale 1. */
export function nftVersionOf(slug: string): number {
  return getDatabase().nftVersions?.[slug] ?? 1;
}

/** Maior versão entre os itens: a cotação nunca fica abaixo dela. */
export function maxNftVersion(slugs: string[]): number {
  return slugs.reduce((max, slug) => Math.max(max, nftVersionOf(slug)), 1);
}

/** +10% no preço, mantendo as casas decimais do preço atual. */
export function raisedPrice(priceEth: string): string {
  return mulEth(priceEth, 1.1);
}

export type PriceChange = { slug: string; priceEth: string; version: number };

/**
 * Grava no banco do mock o preço e a versão de um `nft.updated`. Versão igual ou antiga é ignorada
 * (devolve `false`): o servidor também não regride.
 */
export function applyPriceChange(change: PriceChange): boolean {
  const db = getDatabase();
  const nft = db.nfts.find((candidate) => candidate.slug === change.slug);
  if (!nft || change.version <= nftVersionOf(change.slug)) return false;
  nft.priceEth = change.priceEth;
  db.nftVersions ??= {};
  db.nftVersions[change.slug] = change.version;
  saveDatabase();
  return true;
}
