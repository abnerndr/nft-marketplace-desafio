export type MergeItem = {
  slug?: string;
  editionId: string;
  quantity: number;
  /** Estoque da edição no momento do merge. */
  available: number;
};

function keyOf(item: MergeItem): string {
  // O id de edição se repete entre NFTs (`ed-1-50`); o slug distingue as linhas.
  return `${item.slug ?? ""}~${item.editionId}`;
}

/**
 * Junta o carrinho de visitante ao do usuário: soma quantidades da mesma edição e
 * nunca passa de `available`. Itens do usuário vêm primeiro; sem estoque, a linha some.
 */
export function mergeGuestCart(guestItems: MergeItem[], userItems: MergeItem[]): MergeItem[] {
  const merged = new Map<string, MergeItem>();

  for (const item of [...userItems, ...guestItems]) {
    const key = keyOf(item);
    const current = merged.get(key);
    if (current) {
      // O estoque mais recente (o do item que chegou depois) vale para a linha toda.
      merged.set(key, { ...current, available: item.available, quantity: current.quantity + item.quantity });
    } else {
      merged.set(key, { ...item });
    }
  }

  return [...merged.values()]
    .map((item) => ({ ...item, quantity: Math.min(item.quantity, item.available) }))
    .filter((item) => item.quantity >= 1);
}
