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
    expect((await addItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 6 }, token)).status).toBe(422);
    expect((await addItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1.5 }, token)).status).toBe(422);
    expect((await addItem({ slug: "emerald-ape-042", editionId: "nope", quantity: 1 }, token)).status).toBe(422);
    expect((await addItem({ slug: "nao-existe", editionId: "ed-1-50", quantity: 1 }, token)).status).toBe(404);
  });
});
