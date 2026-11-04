import { CancelledError } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSessionIdentity } from "@/features/auth/session-identity";
import { api } from "@/shared/api/client";
import type { Quote } from "@/shared/domain/contracts";
import { ORDER_ATTEMPT_KEY, readOrderAttempt, resolveOrderAttempt } from "./idempotency";
import { submitPlaceOrder, type PlaceOrderInput } from "./api";

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

describe("submitPlaceOrder", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resposta tardia não devolve pedido colocado nem apaga a tentativa guardada", async () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    const body = JSON.stringify({ walletId: input.walletId, couponCode: input.couponCode, quoteVersion: reviewed.version });
    const stored = resolveOrderAttempt(body);
    const attempt = { current: stored };
    setSessionIdentity("user-marina");
    vi.spyOn(api, "post").mockImplementation(async () => {
      setSessionIdentity("user-rafael");
      return { data: placed, status: 200, statusText: "OK", headers: {}, config: {} } as never;
    });

    await expect(submitPlaceOrder(attempt, input)).rejects.toBeInstanceOf(CancelledError);

    expect(attempt.current).toEqual(stored);
    expect(readOrderAttempt()).toEqual(stored);
    expect(sessionStorage.getItem(ORDER_ATTEMPT_KEY)).toContain(stored.key);
  });
});
