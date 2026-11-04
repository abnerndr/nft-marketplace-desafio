import { CancelledError, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRef } from "react";
import { useSession } from "@/features/auth/session";
import { captureSessionIdentity, isCurrentSession, privateQueryKey } from "@/features/auth/session-identity";
import { requestQuote, toQuoteItems } from "@/features/cart/quote";
import { api } from "@/shared/api/client";
import { orderSchema, type CartLine, type Order, type Quote } from "@/shared/domain/contracts";
import {
  clearOrderAttempt,
  readOrderAttempt,
  resolveOrderAttempt,
  sameOrderAttempt,
  type OrderAttempt,
} from "./idempotency";

export const orderQueryKey = (userId: string, id: string) => privateQueryKey(userId, "order", id);

export function orderQuery(userId: string, id: string) {
  return queryOptions({
    queryKey: orderQueryKey(userId, id),
    queryFn: async ({ signal }) => {
      const identity = captureSessionIdentity();
      const { data } = await api.get(`/orders/${encodeURIComponent(id)}`, { signal });
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return orderSchema.parse(data);
    },
    // O Socket.IO traz `order.updated`; enquanto pendente, volta a perguntar ao servidor por garantia
    // (queda do socket, recarga no meio do pedido).
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 1500 : false),
  });
}

export function useOrder(id: string) {
  const userId = useSession().data?.id;
  return useQuery({
    ...orderQuery(userId ?? "pending", id),
    enabled: Boolean(userId),
  });
}

export type PlaceOrderInput = {
  walletId: string;
  couponCode: string | null;
  lines: CartLine[];
  /** Cotação que o usuário revisou na tela. */
  reviewed: Quote;
};

export type PlaceOrderResult = { kind: "changed"; quote: Quote } | { kind: "placed"; order: Order };

/** Falha sem resposta HTTP (timeout, rede) ou 5xx: o servidor pode ter gravado o pedido. */
function outcomeUnknown(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  return !error.response || error.response.status >= 500;
}

function forgetAttempt(attempt: { current: OrderAttempt | null }): void {
  attempt.current = null;
  clearOrderAttempt();
}

/**
 * Confirma a compra. Antes de criar a tentativa pede uma cotação nova com a revisão mostrada:
 * se a `version` mudou, devolve `changed` e não envia o pedido. Cada tentativa tem um UUID que
 * fica no `sessionStorage` enquanto o resultado é incerto, então o retry depois de timeout ou um
 * reload de `/checkout` reenvia a mesma chave e o mesmo corpo. Corpo diferente (outra carteira,
 * outra revisão) é outra tentativa, com chave nova.
 */
export async function submitPlaceOrder(
  attempt: { current: OrderAttempt | null },
  { walletId, couponCode, lines, reviewed }: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const body = JSON.stringify({ walletId, couponCode, quoteVersion: reviewed.version });

  const identity = captureSessionIdentity();
  if (!attempt.current || !sameOrderAttempt(attempt.current.body, body)) {
    const fresh = await requestQuote(toQuoteItems(lines), couponCode, undefined, reviewed.version);
    if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
    if (fresh.version !== reviewed.version) return { kind: "changed", quote: fresh };
    attempt.current = resolveOrderAttempt(body);
  }

  if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
  try {
    const { data } = await api.post("/orders", body, {
      headers: { "Idempotency-Key": attempt.current.key, "Content-Type": "application/json" },
    });
    if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
    forgetAttempt(attempt);
    return { kind: "placed", order: orderSchema.parse(data) };
  } catch (error) {
    if (error instanceof CancelledError) throw error;
    if (!outcomeUnknown(error)) forgetAttempt(attempt);
    throw error;
  }
}

export function usePlaceOrder() {
  const client = useQueryClient();
  const attempt = useRef<OrderAttempt | null>(readOrderAttempt());

  return useMutation({
    mutationFn: (input: PlaceOrderInput) => submitPlaceOrder(attempt, input),
    onMutate: () => captureSessionIdentity(),
    onSuccess: (result, _vars, identity) => {
      if (!isCurrentSession(identity) || !identity.userId || result.kind !== "placed") return;
      client.setQueryData(orderQueryKey(identity.userId, result.order.id), result.order);
      // Sem retornar a promessa: a navegação para o recibo não espera o carrinho recarregar.
      void client.invalidateQueries({ queryKey: privateQueryKey(identity.userId, "cart") });
    },
  });
}
