import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeSessionToken } from "@/features/auth/session";
import { api } from "@/shared/api/client";
import { getDatabase, initMockState } from "@/mocks/db";
import { applyScenario } from "@/mocks/scenarios";
import { authHandlers } from "@/mocks/handlers/auth";
import { cartHandlers } from "@/mocks/handlers/cart";
import { nftHandlers } from "@/mocks/handlers/nfts";
import { quoteHandlers } from "@/mocks/handlers/quote";
import { addGuestItem, GUEST_CART_KEY, GUEST_COUPON_KEY, readGuestItems, setGuestCoupon } from "./guest-cart";
import { readMergeAttempt } from "./merge-attempt";
import { syncGuestCart, syncGuestCoupon } from "./sync";

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

let token = "";
const server = setupServer(...authHandlers, ...nftHandlers, ...cartHandlers, ...quoteHandlers);

describe("carrinho de visitante e sincronização no login", () => {
  beforeAll(() => {
    api.defaults.baseURL = "http://kurio.test/api";
    server.listen({ onUnhandledFrame: "error" });
  });
  beforeEach(async () => {
    vi.stubGlobal("location", new URL("http://kurio.test/"));
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    initMockState("?reset=1");
    const login = await fetch("http://kurio.test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "marina@kurio.test", password: "Marina#2026" }),
    });
    token = (await login.json()).token;
  });
  afterEach(() => {
    server.resetHandlers();
    applyScenario("default");
    vi.unstubAllGlobals();
  });
  afterAll(() => server.close());

  function signIn() {
    writeSessionToken(token);
  }

  it("visitante adiciona sem login e a regra de estoque vale localmente", () => {
    addGuestItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 3, available: 5 });
    expect(() => addGuestItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 3, available: 5 })).toThrow(
      /Só há 5/,
    );
    expect(readGuestItems()).toEqual([{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 3 }]);
  });

  it("no login envia os itens uma vez, soma ao carrinho do usuário e apaga a chave", async () => {
    addGuestItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 4 });
    addGuestItem({ slug: "violet-nomad-314", editionId: "ed-open", quantity: 1 });
    signIn();
    const db = getDatabase();
    db.carts["user-marina"] = { items: [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 3 }], couponCode: null };

    await syncGuestCart("user-marina");

    expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull();
    const items = getDatabase().carts["user-marina"].items;
    expect(items.find((item) => item.slug === "emerald-ape-042")?.quantity).toBe(5);
    expect(items.find((item) => item.slug === "violet-nomad-314")?.quantity).toBe(1);

    await syncGuestCart("user-marina");
    expect(getDatabase().carts["user-marina"].items).toEqual(items);
  });

  it("falha no meio do merge preserva as linhas do visitante e a tentativa", async () => {
    addGuestItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1 });
    addGuestItem({ slug: "sage-nomad-009", editionId: "ed-1-50", quantity: 1 });
    signIn();
    server.use(
      http.post("/api/cart/merge", () =>
        HttpResponse.json({ error: { code: "unavailable", message: "down" } }, { status: 503 }),
      ),
    );

    await expect(syncGuestCart("user-marina")).rejects.toBeTruthy();
    expect(readGuestItems()).toHaveLength(2);
    expect(readMergeAttempt("user-marina")?.lines).toHaveLength(2);
  });

  it("replay do merge não duplica quantidades", async () => {
    addGuestItem({ slug: "sage-nomad-009", editionId: "ed-1-50", quantity: 2 });
    signIn();
    const first = await syncGuestCart("user-marina");
    expect(
      (first?.cart.items as { slug: string }[] | undefined)?.find((item) => item.slug === "sage-nomad-009"),
    ).toBeTruthy();

    // Simula tentativa regravada e guest limpo: reenvio via mergeId no banco.
    const mergeId = Object.keys(getDatabase().cartMerges ?? {})[0]?.split(":")[1];
    expect(mergeId).toBeTruthy();
    const { data: replay } = await api.post(
      "/cart/merge",
      { lines: [{ slug: "sage-nomad-009", editionId: "ed-1-50", quantity: 2 }], couponCode: null },
      { headers: { "Idempotency-Key": mergeId } },
    );
    expect(replay.cart).toEqual(first?.cart);
    expect(getDatabase().carts["user-marina"].items.filter((item) => item.slug === "sage-nomad-009")).toHaveLength(1);
  });

  it("no login o cupom do visitante vai para o carrinho sem cupom e a chave some", async () => {
    setGuestCoupon("DROP5");
    signIn();

    await syncGuestCoupon();

    expect(getDatabase().carts["user-marina"].couponCode).toBe("DROP5");
    expect(localStorage.getItem(GUEST_COUPON_KEY)).toBeNull();
  });

  it("se o usuário já tem cupom, mantém o dele e só apaga a chave do visitante", async () => {
    getDatabase().carts["user-marina"].couponCode = "GENESIS10";
    setGuestCoupon("DROP5");
    signIn();

    await syncGuestCoupon();

    expect(getDatabase().carts["user-marina"].couponCode).toBe("GENESIS10");
    expect(localStorage.getItem(GUEST_COUPON_KEY)).toBeNull();
  });

  it("cupom recusado pelo servidor também apaga a chave, sem derrubar o login", async () => {
    setGuestCoupon("VENCIDO");
    signIn();

    await expect(syncGuestCoupon()).resolves.toBeUndefined();

    expect(getDatabase().carts["user-marina"].couponCode).toBeNull();
    expect(localStorage.getItem(GUEST_COUPON_KEY)).toBeNull();
  });
});
