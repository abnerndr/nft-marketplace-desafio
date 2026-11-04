import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOrderAttempt,
  ORDER_ATTEMPT_KEY_PREFIX,
  ORDER_OUTCOME_UNKNOWN,
  readOrderAttempt,
  resolveOrderAttempt,
  sameOrderAttempt,
} from "./idempotency";

const body = JSON.stringify({ walletId: "wallet-marina-1", couponCode: "GENESIS10", quoteVersion: 1 });
const USER = "user-marina";

describe("sameOrderAttempt", () => {
  it("reconhece o mesmo corpo como a mesma tentativa", () => {
    expect(sameOrderAttempt(body, body)).toBe(true);
  });

  it("ignora a ordem das chaves e o espaçamento do JSON", () => {
    const reordered = '{ "quoteVersion": 1, "couponCode": "GENESIS10", "walletId": "wallet-marina-1" }';
    expect(sameOrderAttempt(body, reordered)).toBe(true);
  });

  it("trata corpo diferente como outra tentativa", () => {
    const other = JSON.stringify({ walletId: "wallet-marina-2", couponCode: "GENESIS10", quoteVersion: 1 });
    expect(sameOrderAttempt(body, other)).toBe(false);
  });

  it("não considera a mesma tentativa quando a versão da cotação muda", () => {
    const next = JSON.stringify({ walletId: "wallet-marina-1", couponCode: "GENESIS10", quoteVersion: 2 });
    expect(sameOrderAttempt(body, next)).toBe(false);
  });

  it("compara texto cru quando o corpo não é JSON válido", () => {
    expect(sameOrderAttempt("abc", "abc")).toBe(true);
    expect(sameOrderAttempt("abc", "abd")).toBe(false);
  });
});

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

describe("tentativa de pedido no sessionStorage", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reusa a mesma chave e o mesmo corpo depois de um reload", () => {
    const first = resolveOrderAttempt(USER, body);
    expect(sessionStorage.getItem(`${ORDER_ATTEMPT_KEY_PREFIX}${USER}`)).toContain(first.key);

    const restored = readOrderAttempt(USER);
    expect(restored).toEqual(first);
    expect(resolveOrderAttempt(USER, body).key).toBe(first.key);
    expect(resolveOrderAttempt(USER, body).body).toBe(first.body);
  });

  it("corpo diferente não substitui tentativa desconhecida", () => {
    const first = resolveOrderAttempt(USER, body);
    const next = JSON.stringify({ walletId: "wallet-marina-2", couponCode: "GENESIS10", quoteVersion: 1 });
    expect(() => resolveOrderAttempt(USER, next)).toThrow(ORDER_OUTCOME_UNKNOWN);
    expect(readOrderAttempt(USER)?.key).toBe(first.key);
  });

  it("outra conta não lê a tentativa privada", () => {
    resolveOrderAttempt(USER, body);
    expect(readOrderAttempt("user-rafael")).toBeNull();
  });

  it("limpar a tentativa apaga a chave do sessionStorage", () => {
    resolveOrderAttempt(USER, body);
    clearOrderAttempt(USER);
    expect(readOrderAttempt(USER)).toBeNull();
    expect(sessionStorage.getItem(`${ORDER_ATTEMPT_KEY_PREFIX}${USER}`)).toBeNull();
  });
});
