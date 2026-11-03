import { keepPreviousData, queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { quoteSchema, type CartLine } from "@/shared/domain/contracts";

export const quoteQueryKey = ["quote"] as const;

type QuoteItem = { slug: string; editionId: string; quantity: number };

function toQuoteItems(lines: CartLine[]): QuoteItem[] {
  return lines.map(({ slug, editionId, quantity }) => ({ slug, editionId, quantity }));
}

async function requestQuote(items: QuoteItem[], couponCode: string | null, signal?: AbortSignal) {
  const { data } = await api.post("/quote", { items, couponCode }, { signal });
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

/** Confere um cupom contra a API antes de aplicá-lo. Falha com o erro do campo `couponCode`. */
export function useCheckCoupon(lines: CartLine[]) {
  return useMutation({
    mutationFn: async (couponCode: string) => {
      await requestQuote(toQuoteItems(lines), couponCode);
      return couponCode;
    },
  });
}
