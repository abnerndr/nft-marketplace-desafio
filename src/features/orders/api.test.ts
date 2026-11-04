import { CancelledError } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSessionIdentity } from "@/features/auth/session-identity";
import { api } from "@/shared/api/client";
import type { Quote } from "@/shared/domain/contracts";
import { ORDER_ATTEMPT_KEY_PREFIX, ORDER_OUTCOME_UNKNOWN, readOrderAttempt, resolveOrderAttempt } from "./idempotency";
import { recoverOrderAttempt, submitPlaceOrder, type PlaceOrderInput } from "./api";

const reviewed: Quote = {
  subtotalEth: "1",
  discountEth: "0",
  networkFeeEth: "0.02",
  totalEth: "1.02",
  version: 1,
};

const input: PlaceOrderInput = {
  walletId: "wallet-marina-1",
  couponCode: null,
  lines: [],
  reviewed,
  collector: {
    displayName: "Marina Alves",
    username: "marina",
    profileName: "Marina",
    email: "marina@kurio.test",
    referralCode: "KURIO",
    ensName: "marina",
  },
};

const placed = {
  id: "order-1",
  status: "pending",
  txRef: null,
  createdAt: "2026-11-03T12:00:00.000Z",
  wallet: { label: "Principal", address: "0x1", network: "ethereum" },
  snapshot: { ...reviewed, items: [], couponCode: null },
};

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, String(value)),
  };
}

describe("submitPlaceOrder / recoverOrderAttempt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resposta tardia não devolve pedido colocado nem apaga a tentativa guardada", async () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    const body = JSON.stringify({
      walletId: input.walletId,
      couponCode: input.couponCode,
      quoteVersion: reviewed.version,
      collector: input.collector,
    });
    setSessionIdentity("user-marina");
    const stored = resolveOrderAttempt("user-marina", body);
    const attempt = { current: stored };
    vi.spyOn(api, "post").mockImplementation(async () => {
      setSessionIdentity("user-rafael");
      return { data: placed, status: 200, statusText: "OK", headers: {}, config: {} } as never;
    });

    await expect(submitPlaceOrder(attempt, input)).rejects.toBeInstanceOf(CancelledError);

    expect(attempt.current).toEqual(stored);
    expect(readOrderAttempt("user-marina")).toEqual(stored);
    expect(sessionStorage.getItem(`${ORDER_ATTEMPT_KEY_PREFIX}user-marina`)).toContain(stored.key);
  });

  it("corpo diferente com tentativa desconhecida lança order_outcome_unknown", async () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    setSessionIdentity("user-marina");
    const bodyA = JSON.stringify({ walletId: "wallet-marina-1", couponCode: null, quoteVersion: 1 });
    const first = resolveOrderAttempt("user-marina", bodyA);
    const attempt = { current: first };
    const bodyBInput: PlaceOrderInput = {
      ...input,
      walletId: "wallet-marina-2",
    };
    await expect(submitPlaceOrder(attempt, bodyBInput)).rejects.toThrow(ORDER_OUTCOME_UNKNOWN);
    expect(readOrderAttempt("user-marina")?.key).toBe(first.key);
  });

  it("recoverOrderAttempt reenvia a mesma chave e limpa quando confirmado", async () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    setSessionIdentity("user-marina");
    const body = JSON.stringify({ walletId: input.walletId, couponCode: input.couponCode, quoteVersion: reviewed.version });
    const attempt = resolveOrderAttempt("user-marina", body);
    const confirmed = { ...placed, status: "confirmed", txRef: "0xabc" };
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: confirmed, status: 200, statusText: "OK", headers: {}, config: {} } as never);

    const order = await recoverOrderAttempt(attempt);
    expect(order.id).toBe("order-1");
    expect(post).toHaveBeenCalledWith(
      "/orders",
      attempt.body,
      expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": attempt.key }) }),
    );
    expect(readOrderAttempt("user-marina")).toBeNull();
  });
});
