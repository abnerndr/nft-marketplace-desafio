import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { quoteSchema } from "@/shared/domain/contracts";
import { GUEST_COUPON_KEY, setGuestCoupon } from "@/features/cart/guest-cart";
import { getDatabase, initMockState } from "../db";
import { authHandlers } from "./auth";
import { cartHandlers } from "./cart";
import { nftHandlers } from "./nfts";
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

const server = setupServer(...authHandlers, ...nftHandlers, ...cartHandlers, ...quoteHandlers);
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

describe("cupom salvo no carrinho", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(() => initMockState("?reset=1"));
  afterAll(() => server.close());

  async function login(): Promise<string> {
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "marina@kurio.test", password: "Marina#2026" }),
    });
    return (await response.json()).token;
  }

  function putCoupon(token: string | null, couponCode: string | null) {
    return fetch(`${base}/cart/coupon`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ couponCode }),
    });
  }

  async function storedCoupon(token: string): Promise<string | null> {
    const response = await fetch(`${base}/cart`, { headers: { Authorization: `Bearer ${token}` } });
    return (await response.json()).couponCode;
  }

  it("exige sessão", async () => {
    expect((await putCoupon(null, "GENESIS10")).status).toBe(401);
  });

  it("salva o cupom válido no carrinho e o GET /cart devolve", async () => {
    const token = await login();
    const response = await putCoupon(token, "genesis10");
    expect(response.status).toBe(200);
    expect(await storedCoupon(token)).toBe("GENESIS10");
    expect(getDatabase().carts["user-marina"].couponCode).toBe("GENESIS10");
  });

  it("remover limpa o cupom salvo", async () => {
    const token = await login();
    await putCoupon(token, "DROP5");
    expect((await putCoupon(token, null)).status).toBe(200);
    expect(await storedCoupon(token)).toBeNull();
  });

  it("cupom inválido ou expirado não substitui o cupom válido salvo", async () => {
    const token = await login();
    await putCoupon(token, "GENESIS10");

    const expired = await putCoupon(token, "VENCIDO");
    expect(expired.status).toBe(422);
    expect((await expired.json()).error.fields.couponCode).toBeTruthy();
    const invalid = await putCoupon(token, "XYZ");
    expect(invalid.status).toBe(422);

    expect(await storedCoupon(token)).toBe("GENESIS10");
  });
});

describe("cupom do visitante", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("guarda o cupom ao lado do carrinho e remover limpa", () => {
    setGuestCoupon("GENESIS10");
    expect(localStorage.getItem(GUEST_COUPON_KEY)).toBe("GENESIS10");

    setGuestCoupon(null);
    expect(localStorage.getItem(GUEST_COUPON_KEY)).toBeNull();
  });
});
