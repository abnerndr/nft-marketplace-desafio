import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, initMockState } from "../db";
import { applyScenario } from "../scenarios";
import { authHandlers } from "./auth";
import { cartHandlers } from "./cart";
import { nftHandlers } from "./nfts";

vi.stubGlobal("location", new URL("http://kurio.test/"));

const server = setupServer(...authHandlers, ...nftHandlers, ...cartHandlers);
const base = "http://kurio.test/api";

async function login(): Promise<string> {
  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "marina@kurio.test", password: "Marina#2026" }),
  });
  return (await response.json()).token;
}

function addItem(body: unknown, token?: string) {
  return fetch(`${base}/cart/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

describe("detalhe do NFT e POST /api/cart/items", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(() => initMockState("?reset=1"));
  afterEach(() => applyScenario("default"));
  afterAll(() => server.close());

  it("devolve o detalhe com edições e 404 not_found para slug inexistente", async () => {
    const found = await fetch(`${base}/nfts/emerald-ape-042`);
    expect(found.status).toBe(200);
    const detail = await found.json();
    expect(detail.priceEth).toBe("1.19");
    expect(detail.editions.map((edition: { label: string }) => edition.label)).toEqual(["1/1", "1/10", "1/50", "ABERTA"]);
    expect(detail.editions[0].available).toBe(0);

    const missing = await fetch(`${base}/nfts/nao-existe`);
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("not_found");
  });

  it("exige sessão", async () => {
    const response = await addItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1 });
    expect(response.status).toBe(401);
  });

  it("guarda o item no carrinho e soma quantidades da mesma edição", async () => {
    const token = await login();
    const body = { slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 2 };
    expect((await addItem(body, token)).status).toBe(201);
    expect((await addItem(body, token)).status).toBe(201);
    expect(getDatabase().carts["user-marina"].items).toEqual([{ ...body, quantity: 4 }]);
  });

  it("rejeita edição esgotada, quantidade fora do estoque e quantidade fracionada", async () => {
    const token = await login();
    expect((await addItem({ slug: "emerald-ape-042", editionId: "ed-1-1", quantity: 1 }, token)).status).toBe(409);
    const over = await addItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 6 }, token);
    expect(over.status).toBe(409);
    expect((await over.json()).error.code).toBe("conflict");
    expect((await addItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1.5 }, token)).status).toBe(422);
    expect((await addItem({ slug: "emerald-ape-042", editionId: "nope", quantity: 1 }, token)).status).toBe(422);
    expect((await addItem({ slug: "nao-existe", editionId: "ed-1-50", quantity: 1 }, token)).status).toBe(404);
  });

  it("não corta em silêncio: somar acima do estoque responde 409 e mantém a quantidade", async () => {
    const token = await login();
    const body = { slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 3 };
    expect((await addItem(body, token)).status).toBe(201);
    const response = await addItem(body, token);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("conflict");
    expect(getDatabase().carts["user-marina"].items[0].quantity).toBe(3);
  });
});

function authed(path: string, token: string | undefined, init: RequestInit = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

describe("GET, PATCH e DELETE do carrinho", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(() => initMockState("?reset=1"));
  afterEach(() => applyScenario("default"));
  afterAll(() => server.close());

  it("exige sessão nas três rotas", async () => {
    expect((await authed("/cart", undefined)).status).toBe(401);
    expect((await authed("/cart/items/emerald-ape-042~ed-1-50", undefined, { method: "PATCH", body: "{}" })).status).toBe(401);
    expect((await authed("/cart/items/emerald-ape-042~ed-1-50", undefined, { method: "DELETE" })).status).toBe(401);
  });

  it("GET devolve as linhas com título, edição, estoque e preço", async () => {
    const token = await login();
    expect(await (await authed("/cart", token)).json()).toEqual({ items: [], couponCode: null });

    await addItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 2 }, token);
    const cart = await (await authed("/cart", token)).json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      id: "emerald-ape-042~ed-1-50",
      title: "Emerald Ape #042",
      tokenId: "#0042",
      editionLabel: "1/50",
      available: 5,
      priceEth: "1.19",
      quantity: 2,
    });
  });

  it("PATCH altera a quantidade, recusa acima do estoque (409) e valor inválido (422)", async () => {
    const token = await login();
    await addItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1 }, token);
    const path = "/cart/items/emerald-ape-042~ed-1-50";
    const patch = (quantity: unknown) => authed(path, token, { method: "PATCH", body: JSON.stringify({ quantity }) });

    expect((await patch(4)).status).toBe(200);
    expect(getDatabase().carts["user-marina"].items[0].quantity).toBe(4);

    const over = await patch(6);
    expect(over.status).toBe(409);
    expect((await over.json()).error.code).toBe("conflict");
    expect((await patch(0)).status).toBe(422);
    expect((await patch(1.5)).status).toBe(422);
    expect(getDatabase().carts["user-marina"].items[0].quantity).toBe(4);

    const missing = await authed("/cart/items/nao-existe~ed-1-50", token, { method: "PATCH", body: JSON.stringify({ quantity: 1 }) });
    expect(missing.status).toBe(404);
  });

  it("DELETE tira a linha e o refresh (GET) já não a traz", async () => {
    const token = await login();
    await addItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1 }, token);
    await addItem({ slug: "emerald-ape-042", editionId: "ed-open", quantity: 1 }, token);
    const removed = await authed("/cart/items/emerald-ape-042~ed-1-50", token, { method: "DELETE" });
    expect(removed.status).toBe(204);
    const cart = await (await authed("/cart", token)).json();
    expect(cart.items.map((line: { editionId: string }) => line.editionId)).toEqual(["ed-open"]);
    expect((await authed("/cart/items/emerald-ape-042~ed-1-50", token, { method: "DELETE" })).status).toBe(404);
  });
});
