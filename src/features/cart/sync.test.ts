import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeSessionToken } from "@/features/auth/session";
import { api } from "@/shared/api/client";
import { getDatabase, initMockState } from "@/mocks/db";
import { applyScenario } from "@/mocks/scenarios";
import { authHandlers } from "@/mocks/handlers/auth";
import { cartHandlers } from "@/mocks/handlers/cart";
import { nftHandlers } from "@/mocks/handlers/nfts";
import { addGuestItem, GUEST_CART_KEY, readGuestItems } from "./guest-cart";
import { syncGuestCart } from "./sync";

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
const server = setupServer(...authHandlers, ...nftHandlers, ...cartHandlers);

describe("carrinho de visitante e sincronização no login", () => {
  beforeAll(() => {
    api.defaults.baseURL = "http://kurio.test/api";
    server.listen({ onUnhandledFrame: "error" });
  });
  beforeEach(async () => {
    vi.stubGlobal("location", new URL("http://kurio.test/"));
    vi.stubGlobal("localStorage", memoryStorage());
    initMockState("?reset=1");
    const login = await fetch("http://kurio.test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "marina@kurio.test", password: "Marina#2026" }),
    });
    token = (await login.json()).token;
  });
  afterEach(() => {
    applyScenario("default");
    vi.unstubAllGlobals();
  });
  afterAll(() => server.close());

  function signIn() {
    // O token foi aberto no beforeEach; grava no storage de teste como o login faria.
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

    await syncGuestCart();

    expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull();
    const items = getDatabase().carts["user-marina"].items;
    // 3 + 4 passa do estoque (5): sobe até o limite, sem estourar.
    expect(items.find((item) => item.slug === "emerald-ape-042")?.quantity).toBe(5);
    expect(items.find((item) => item.slug === "violet-nomad-314")?.quantity).toBe(1);

    await syncGuestCart();
    expect(getDatabase().carts["user-marina"].items).toEqual(items);
  });
});
