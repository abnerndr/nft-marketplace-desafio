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
  markOrderAttemptPending,
  ORDER_OUTCOME_UNKNOWN,
  readOrderAttempt,
  resolveOrderAttempt,
  sameOrderAttempt,
  writeOrderAttempt,
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

export type PlaceOrderCollector = {
  displayName: string;
  username: string;
  profileName: string;
  email: string;
  referralCode: string;
  ensName: string;
  secondaryAddress?: string;
  note?: string;
};

export type PlaceOrderInput = {
  walletId: string;
  couponCode: string | null;
  lines: CartLine[];
  /** Cotação que o usuário revisou na tela. */
  reviewed: Quote;
  collector: PlaceOrderCollector;
};

export type PlaceOrderResult = { kind: "changed"; quote: Quote } | { kind: "placed"; order: Order };

/** Falha sem resposta HTTP (timeout, rede) ou 5xx: o servidor pode ter gravado o pedido. */
function outcomeUnknown(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  return !error.response || error.response.status >= 500;
}

function forgetAttempt(attempt: { current: OrderAttempt | null }, userId?: string | null): void {
  const id = userId ?? attempt.current?.userId;
  attempt.current = null;
  clearOrderAttempt(id);
}

/**
 * Reenvia exatamente corpo/chave da tentativa original. Não valida cotação/carteira atuais —
 * o servidor devolve o pedido já gravado via idempotência.
 */
export async function recoverOrderAttempt(attempt: OrderAttempt): Promise<Order> {
  const identity = captureSessionIdentity();
  if (identity.userId !== attempt.userId) {
    throw new CancelledError({ silent: true });
  }
  try {
    const { data } = await api.post("/orders", attempt.body, {
      headers: { "Idempotency-Key": attempt.key, "Content-Type": "application/json" },
    });
    if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
    const order = orderSchema.parse(data);
    if (order.status === "pending") {
      writeOrderAttempt(markOrderAttemptPending(attempt, order.id));
    } else {
      clearOrderAttempt(attempt.userId);
    }
    return order;
  } catch (error) {
    if (error instanceof CancelledError) throw error;
    // Timeout de recuperação preserva a tentativa desconhecida.
    if (!outcomeUnknown(error)) {
      clearOrderAttempt(attempt.userId);
    }
    throw error;
  }
}

/**
 * Confirma a compra. Enquanto houver tentativa com resultado desconhecido, um corpo diferente
 * não gera chave nova — lança `order_outcome_unknown` para forçar `recoverOrderAttempt`.
 */
export async function submitPlaceOrder(
  attempt: { current: OrderAttempt | null },
  { walletId, couponCode, lines, reviewed, collector }: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const body = JSON.stringify({ walletId, couponCode, quoteVersion: reviewed.version, collector });
  const identity = captureSessionIdentity();
  if (!identity.userId) throw new CancelledError({ silent: true });

  const stored = readOrderAttempt(identity.userId) ?? attempt.current;
  if (stored && stored.userId === identity.userId && !sameOrderAttempt(stored.body, body)) {
    attempt.current = stored;
    throw new Error(ORDER_OUTCOME_UNKNOWN);
  }

  if (!stored || !sameOrderAttempt(stored.body, body)) {
    const fresh = await requestQuote(toQuoteItems(lines), couponCode, undefined, reviewed.version);
    if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
    if (fresh.version !== reviewed.version) return { kind: "changed", quote: fresh };
    attempt.current = resolveOrderAttempt(identity.userId, body);
  } else {
    attempt.current = stored;
  }

  if (!isCurrentSession(identity) || !attempt.current) throw new CancelledError({ silent: true });
  try {
    const { data } = await api.post("/orders", attempt.current.body, {
      headers: { "Idempotency-Key": attempt.current.key, "Content-Type": "application/json" },
    });
    if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
    const order = orderSchema.parse(data);
    if (order.status === "pending") {
      attempt.current = markOrderAttemptPending(attempt.current, order.id);
    } else {
      forgetAttempt(attempt, identity.userId);
    }
    return { kind: "placed", order };
  } catch (error) {
    if (error instanceof CancelledError) throw error;
    if (!outcomeUnknown(error)) forgetAttempt(attempt, identity.userId);
    else if (attempt.current) {
      writeOrderAttempt({ ...attempt.current, state: "unknown" });
    }
    throw error;
  }
}

export function usePlaceOrder() {
  const client = useQueryClient();
  const userId = useSession().data?.id;
  const attempt = useRef<OrderAttempt | null>(readOrderAttempt(userId));

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
