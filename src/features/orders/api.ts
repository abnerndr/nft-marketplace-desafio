import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRef } from "react";
import { requestQuote, toQuoteItems } from "@/features/cart/quote";
import { cartQueryKey } from "@/features/cart/api";
import { api } from "@/shared/api/client";
import { orderSchema, type CartLine, type Order, type Quote } from "@/shared/domain/contracts";
import { newIdempotencyKey, sameOrderAttempt } from "./idempotency";

export const orderQueryKey = (id: string) => ["order", id] as const;

export function orderQuery(id: string) {
  return queryOptions({
    queryKey: orderQueryKey(id),
    queryFn: async () => {
      const { data } = await api.get(`/orders/${encodeURIComponent(id)}`);
      return orderSchema.parse(data);
    },
    // O Socket.IO traz `order.updated`; enquanto pendente, volta a perguntar ao servidor por garantia
    // (queda do socket, recarga no meio do pedido).
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 1500 : false),
  });
}

export function useOrder(id: string) {
  return useQuery(orderQuery(id));
}

export type PlaceOrderInput = {
  walletId: string;
  couponCode: string | null;
  lines: CartLine[];
  /** Cotação que o usuário revisou na tela. */
  reviewed: Quote;
};

export type PlaceOrderResult = { kind: "changed"; quote: Quote } | { kind: "placed"; order: Order };

type Attempt = { key: string; body: string };

/** Falha sem resposta HTTP (timeout, rede) ou 5xx: o servidor pode ter gravado o pedido. */
function outcomeUnknown(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  return !error.response || error.response.status >= 500;
}

/**
 * Confirma a compra. Antes de criar a tentativa pede uma cotação nova com a revisão mostrada:
 * se a `version` mudou, devolve `changed` e não envia o pedido. Cada tentativa tem um UUID que
 * fica guardado enquanto o resultado é incerto, então o retry depois de timeout reenvia a mesma
 * chave. Corpo diferente (outra carteira, outra revisão) é outra tentativa, com chave nova.
 */
export function usePlaceOrder() {
  const client = useQueryClient();
  const attempt = useRef<Attempt | null>(null);

  return useMutation({
    mutationFn: async ({ walletId, couponCode, lines, reviewed }: PlaceOrderInput): Promise<PlaceOrderResult> => {
      const body = JSON.stringify({ walletId, couponCode, quoteVersion: reviewed.version });

      if (!attempt.current || !sameOrderAttempt(attempt.current.body, body)) {
        const fresh = await requestQuote(toQuoteItems(lines), couponCode, undefined, reviewed.version);
        if (fresh.version !== reviewed.version) return { kind: "changed", quote: fresh };
        attempt.current = { key: newIdempotencyKey(), body };
      }

      try {
        const { data } = await api.post("/orders", body, {
          headers: { "Idempotency-Key": attempt.current.key, "Content-Type": "application/json" },
        });
        attempt.current = null;
        return { kind: "placed", order: orderSchema.parse(data) };
      } catch (error) {
        if (!outcomeUnknown(error)) attempt.current = null;
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.kind !== "placed") return;
      client.setQueryData(orderQueryKey(result.order.id), result.order);
      // Sem retornar a promessa: a navegação para o recibo não espera o carrinho recarregar.
      void client.invalidateQueries({ queryKey: cartQueryKey });
    },
  });
}
