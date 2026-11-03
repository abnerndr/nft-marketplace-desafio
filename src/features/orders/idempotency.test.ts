import { describe, expect, it } from "vitest";
import { sameOrderAttempt } from "./idempotency";

const body = JSON.stringify({ walletId: "wallet-marina-1", couponCode: "GENESIS10", quoteVersion: 1 });

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
