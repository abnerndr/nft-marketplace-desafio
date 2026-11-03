import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
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

/** Cotação do carrinho. Serve visitante e usuário logado: o corpo carrega os itens. */
export function quoteQuery(lines: CartLine[], couponCode: string | null) {
  const items = toQuoteItems(lines);
  return queryOptions({
    queryKey: [...quoteQueryKey, items, couponCode] as const,
    queryFn: ({ signal }) => requestQuote(items, couponCode, signal),
  });
}

export function useQuote(lines: CartLine[], couponCode: string | null) {
  return useQuery({ ...quoteQuery(lines, couponCode), placeholderData: keepPreviousData });
}
