import { canTransitionOrder } from "@/features/orders/transitions";
import type { OrderStatus } from "@/shared/domain/contracts";
import { getDatabase, saveDatabase } from "./db";
import { commitInventory, releaseInventory } from "./inventory";
import { applyPriceChange } from "./nft-version";

export { canTransitionOrder };

export type NftUpdateInput = {
  slug: string;
  priceEth: string;
  version: number;
  available?: number;
};

/** Persiste preço/versão/estoque do NFT e devolve o resource pronto para o evento. */
export function commitNftUpdate(input: NftUpdateInput): NftUpdateInput | null {
  if (!applyPriceChange({ slug: input.slug, priceEth: input.priceEth, version: input.version })) {
    return null;
  }
  const db = getDatabase();
  const nft = db.nfts.find((candidate) => candidate.slug === input.slug);
  if (!nft) return null;
  if (input.available !== undefined) {
    nft.available = input.available;
    saveDatabase();
  }
  return {
    slug: nft.slug,
    priceEth: nft.priceEth,
    version: nft.priceVersion ?? input.version,
    available: nft.available,
  };
}

/** Transição persistida do pedido mock. Só pending → confirmed|declined. */
export function transitionMockOrder(
  id: string,
  next: OrderStatus,
  txRef?: string | null,
): { id: string; status: OrderStatus; txRef: string | null } | null {
  const db = getDatabase();
  const record = db.orders.find((order) => order.id === id);
  if (!record || !canTransitionOrder(record.status, next)) return null;
  record.status = next;
  if (next === "confirmed") {
    record.txRef = txRef ?? record.txRef ?? `0x${crypto.randomUUID().replace(/-/g, "")}`;
    commitInventory(record.id);
  } else {
    record.txRef = null;
    releaseInventory(record.id);
  }
  saveDatabase();
  return { id: record.id, status: record.status, txRef: record.txRef };
}
