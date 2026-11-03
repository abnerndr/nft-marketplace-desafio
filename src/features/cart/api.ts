import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSession } from "@/features/auth/session";
import { nftDetailQuery } from "@/features/nft/api";
import { api } from "@/shared/api/client";
import { queryClient } from "@/shared/api/query-client";
import { cartViewSchema, type CartLine } from "@/shared/domain/contracts";
import { addEth, mulEth } from "@/shared/domain/money";
import {
  parseGuestItems,
  removeGuestItem,
  setGuestQuantity,
  useGuestCartRaw,
} from "./guest-cart";

export const cartQueryKey = ["cart"] as const;

/** Taxa de rede estimada do frame. A cotação real chega na Task 10. */
export const NETWORK_FEE_ETH = "0.016";

const serverCartQuery = queryOptions({
  queryKey: [...cartQueryKey, "server"] as const,
  queryFn: async ({ signal }) => {
    const { data } = await api.get("/cart", { signal });
    return cartViewSchema.parse(data);
  },
});

/** Linhas de exibição do visitante: o item guardado mais o detalhe atual do NFT. */
async function loadGuestLines(raw: string): Promise<CartLine[]> {
  const items = parseGuestItems(raw);
  const lines = await Promise.all(
    items.map(async (item): Promise<CartLine | null> => {
      try {
        const nft = await queryClient.fetchQuery({ ...nftDetailQuery(item.slug), staleTime: 15_000 });
        const edition = nft.editions.find((candidate) => candidate.id === item.editionId);
        if (!edition) return null;
        return {
          id: `${item.slug}~${item.editionId}`,
          slug: item.slug,
          editionId: item.editionId,
          quantity: item.quantity,
          editionLabel: edition.label,
          available: edition.available,
          title: nft.title,
          tokenId: nft.tokenId,
          imageUrl: nft.imageUrl,
          priceEth: nft.priceEth,
        };
      } catch {
        // NFT que sumiu do catálogo não trava o carrinho inteiro.
        return null;
      }
    }),
  );
  return lines.filter((line): line is CartLine => line !== null);
}

export type CartState = {
  lines: CartLine[];
  isGuest: boolean;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

/** Carrinho atual: `GET /api/cart` com sessão, `localStorage` sem sessão. */
export function useCart(): CartState {
  const session = useSession();
  const user = session.data ?? null;
  const raw = useGuestCartRaw();

  const server = useQuery({ ...serverCartQuery, enabled: user !== null });
  const guest = useQuery({
    queryKey: [...cartQueryKey, "guest", raw] as const,
    queryFn: () => loadGuestLines(raw),
    enabled: session.isSuccess && user === null,
    placeholderData: keepPreviousData,
  });

  if (session.isPending) {
    return { lines: [], isGuest: true, isPending: true, isError: false, error: null, refetch: () => void session.refetch() };
  }
  if (session.isError) {
    return { lines: [], isGuest: true, isPending: false, isError: true, error: session.error, refetch: () => void session.refetch() };
  }
  const active = user ? server : guest;
  return {
    lines: (user ? server.data?.items : guest.data) ?? [],
    isGuest: user === null,
    isPending: active.isPending,
    isError: active.isError,
    error: active.error,
    refetch: () => void active.refetch(),
  };
}

/** Total de unidades para o badge do header. Visitante conta direto do `localStorage`. */
export function useCartCount(): number {
  const session = useSession();
  const raw = useGuestCartRaw();
  const user = session.data ?? null;
  const server = useQuery({
    ...serverCartQuery,
    enabled: user !== null,
    select: (cart) => cart.items.reduce((sum, line) => sum + line.quantity, 0),
  });
  const guestCount = useMemo(
    () => parseGuestItems(raw).reduce((sum, item) => sum + item.quantity, 0),
    [raw],
  );
  return user ? (server.data ?? 0) : guestCount;
}

export type CartTotals = { subtotalEth: string; discountEth: string; networkFeeEth: string; totalEth: string };

/** Soma de tela. Sem simular desconto: o cupom e a cotação real são da Task 10. */
export function totalsOf(lines: CartLine[]): CartTotals {
  const subtotalEth = lines.reduce((sum, line) => addEth(sum, mulEth(line.priceEth, line.quantity)), "0");
  return {
    subtotalEth,
    discountEth: "0",
    networkFeeEth: NETWORK_FEE_ETH,
    totalEth: addEth(subtotalEth, NETWORK_FEE_ETH),
  };
}

export function useCartActions(isGuest: boolean) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: cartQueryKey });

  const setQuantity = useMutation({
    mutationFn: async ({ line, quantity }: { line: CartLine; quantity: number }) => {
      if (isGuest) {
        setGuestQuantity(line.slug, line.editionId, quantity, line.available);
        return;
      }
      await api.patch(`/cart/items/${encodeURIComponent(line.id)}`, { quantity });
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (line: CartLine) => {
      if (isGuest) {
        removeGuestItem(line.slug, line.editionId);
        return;
      }
      await api.delete(`/cart/items/${encodeURIComponent(line.id)}`);
    },
    onSettled: refresh,
  });

  return { setQuantity, remove };
}
