import { CancelledError, keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session";
import { captureSessionIdentity, isCurrentSession, privateQueryKey } from "@/features/auth/session-identity";
import { api } from "@/shared/api/client";
import { quoteSchema, type CartLine } from "@/shared/domain/contracts";

export const quoteQueryKey = ["quote"] as const;

type QuoteItem = { slug: string; editionId: string; quantity: number };

export function toQuoteItems(lines: CartLine[]): QuoteItem[] {
  return lines.map(({ slug, editionId, quantity }) => ({ slug, editionId, quantity }));
}

/** `revision` é a versão da cotação que a tela já mostra; o checkout usa para detectar mudança. */
export async function requestQuote(
  items: QuoteItem[],
  couponCode: string | null,
  signal?: AbortSignal,
  revision?: number,
) {
  const { data } = await api.post("/quote", { items, couponCode, revision }, { signal });
  return quoteSchema.parse(data);
}

/** Cotação do carrinho. Visitante fica na chave pública; logado entra na chave privada da conta. */
export function quoteQuery(lines: CartLine[], couponCode: string | null, userId: string | null = null) {
  const items = toQuoteItems(lines);
  return queryOptions({
    queryKey: userId ? privateQueryKey(userId, "quote", items, couponCode) : ([...quoteQueryKey, items, couponCode] as const),
    queryFn: async ({ signal }) => {
      const identity = captureSessionIdentity();
      const quote = await requestQuote(items, couponCode, signal);
      if (userId && !isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return quote;
    },
  });
}

export function checkoutQuoteQuery(userId: string, lines: CartLine[], couponCode: string | null) {
  const items = toQuoteItems(lines);
  return queryOptions({
    queryKey: privateQueryKey(userId, "quote", "checkout", items, couponCode),
    queryFn: async ({ signal }) => {
      const identity = captureSessionIdentity();
      const quote = await requestQuote(items, couponCode, signal);
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return quote;
    },
  });
}

export function useQuote(lines: CartLine[], couponCode: string | null) {
  const session = useSession();
  const userId = session.data?.id ?? null;
  return useQuery({
    ...quoteQuery(lines, couponCode, userId),
    enabled: session.isSuccess,
    placeholderData: keepPreviousData,
  });
}
