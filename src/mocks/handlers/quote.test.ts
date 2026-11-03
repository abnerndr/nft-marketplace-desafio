import { setupServer } from "msw/node";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { quoteSchema } from "@/shared/domain/contracts";
import { initMockState } from "../db";
import { applyCoupon, quoteHandlers } from "./quote";

vi.stubGlobal("location", new URL("http://kurio.test/"));

describe("applyCoupon", () => {
  it("aceita GENESIS10 e DROP5 sem diferenciar maiúsculas", () => {
    expect(applyCoupon("GENESIS10")).toEqual({ ok: true, rate: "0.10" });
    expect(applyCoupon("drop5")).toEqual({ ok: true, rate: "0.05" });
    expect(applyCoupon("  genesis10 ")).toEqual({ ok: true, rate: "0.10" });
  });

  it("rejeita VENCIDO como expirado e o resto como inválido", () => {
    expect(applyCoupon("VENCIDO")).toEqual({ ok: false, reason: "expired" });
    expect(applyCoupon("XYZ")).toEqual({ ok: false, reason: "invalid" });
  });
});

const server = setupServer(...quoteHandlers);
const base = "http://kurio.test/api";

function quote(body: unknown) {
  return fetch(`${base}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const items = [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 2 }];

describe("POST /api/quote", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(() => initMockState("?reset=1"));
  afterAll(() => server.close());

  it("cota sem cupom: subtotal + taxa de rede 0.02", async () => {
    const response = await quote({ items, couponCode: null });
    expect(response.status).toBe(200);
    const parsed = quoteSchema.parse(await response.json());
    expect(parsed.subtotalEth).toBe("2.38");
    expect(parsed.discountEth).toBe("0.00");
    expect(parsed.networkFeeEth).toBe("0.02");
    expect(parsed.totalEth).toBe("2.40");
  });

  it("aplica o desconto sobre o subtotal", async () => {
    const parsed = quoteSchema.parse(await (await quote({ items, couponCode: "genesis10" })).json());
    expect(parsed.discountEth).toBe("0.24");
    expect(parsed.totalEth).toBe("2.16");
  });

  it("responde 422 com erro no campo para cupom expirado ou inválido, sem desconto", async () => {
    const expired = await quote({ items, couponCode: "VENCIDO" });
    expect(expired.status).toBe(422);
    const expiredBody = await expired.json();
    expect(expiredBody.error.code).toBe("coupon_expired");
    expect(expiredBody.error.fields.couponCode).toBeTruthy();

    const invalid = await quote({ items, couponCode: "XYZ" });
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error.code).toBe("coupon_invalid");
  });

  it("cota carrinho vazio com subtotal zero", async () => {
    const parsed = quoteSchema.parse(await (await quote({ items: [], couponCode: null })).json());
    expect(parsed.subtotalEth).toBe("0");
    expect(parsed.totalEth).toBe("0.02");
  });
});
