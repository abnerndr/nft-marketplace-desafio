import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { orderSchema } from "@/shared/domain/contracts";
import { getDatabase, initMockState } from "../db";
import { applyScenario, type ScenarioId } from "../scenarios";
import { authHandlers } from "./auth";
import { cartHandlers } from "./cart";
import { nftHandlers } from "./nfts";
import { orderHandlers } from "./orders";
import { quoteHandlers } from "./quote";
import { walletHandlers } from "./wallets";

vi.stubGlobal("location", new URL("http://kurio.test/"));
// A espera real é de 8 s; o teste só precisa de uma espera curta antes do erro de rede.
vi.mock("../scenarios", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../scenarios")>()),
  ORDER_TIMEOUT_DELAY_MS: 30,
}));

const server = setupServer(
  ...authHandlers,
  ...nftHandlers,
  ...cartHandlers,
  ...quoteHandlers,
  ...walletHandlers,
  ...orderHandlers,
);
const base = "http://kurio.test/api";
const WALLET = "wallet-marina-1";

let token = "";

function call(path: string, init: RequestInit & { key?: string } = {}) {
  const { key, ...rest } = init;
  return fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(key ? { "Idempotency-Key": key } : {}),
    },
  });
}

function patchWallet(id: string, action: string) {
  return call(`/wallets/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
}

function placeOrder(key: string | undefined, body: Record<string, unknown> = {}) {
  return call("/orders", {
    method: "POST",
    key,
    body: JSON.stringify({ walletId: WALLET, couponCode: null, quoteVersion: 1, ...body }),
  });
}

async function fillCart() {
  await call("/cart/items", {
    method: "POST",
    body: JSON.stringify({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 2 }),
  });
  await call("/cart/items", {
    method: "POST",
    body: JSON.stringify({ slug: "violet-nomad-314", editionId: "ed-open", quantity: 1 }),
  });
}

async function ready(scenario: ScenarioId = "default") {
  applyScenario(scenario);
  await fillCart();
  expect((await patchWallet(WALLET, "connect")).status).toBe(200);
}

describe("carteiras simuladas", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(async () => {
    initMockState("?reset=1");
    const login = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "marina@kurio.test", password: "Marina#2026" }),
    });
    token = (await login.json()).token;
  });
  afterEach(() => applyScenario("default"));
  afterAll(() => server.close());

  it("lista as carteiras do seed desconectadas e cria outra com endereço válido", async () => {
    const { wallets } = await (await call("/wallets")).json();
    expect(wallets).toHaveLength(2);
    expect(wallets.every((wallet: { connected: boolean }) => !wallet.connected)).toBe(true);

    const created = await call("/wallets", {
      method: "POST",
      body: JSON.stringify({
        label: "Solana",
        network: "solana",
        provider: "walletconnect",
        address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      }),
    });
    expect(created.status).toBe(201);
    expect((await created.json()).wallet).toMatchObject({ network: "solana", connected: false });

    const bad = await call("/wallets", {
      method: "POST",
      body: JSON.stringify({ label: "x", network: "ethereum", address: "0x123" }),
    });
    expect(bad.status).toBe(422);
    expect((await bad.json()).error.fields.address).toBeDefined();
  });

  it("conecta uma por vez, recusa com wallet-connect-rejected e desconecta", async () => {
    await patchWallet("wallet-marina-1", "connect");
    await patchWallet("wallet-marina-2", "connect");
    const { wallets } = await (await call("/wallets")).json();
    expect(wallets.map((wallet: { connected: boolean }) => wallet.connected)).toEqual([false, true]);

    const rejected = await patchWallet("wallet-marina-1", "reject");
    expect(rejected.status).toBe(409);
    expect((await rejected.json()).error.code).toBe("wallet-connect-rejected");

    await patchWallet("wallet-marina-2", "disconnect");
    const after = await (await call("/wallets")).json();
    expect(after.wallets.every((wallet: { connected: boolean }) => !wallet.connected)).toBe(true);
  });
});

describe("POST /api/orders", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(async () => {
    initMockState("?reset=1");
    const login = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "marina@kurio.test", password: "Marina#2026" }),
    });
    token = (await login.json()).token;
  });
  afterEach(() => applyScenario("default"));
  afterAll(() => server.close());

  it("exige a chave de idempotência, carteira conectada e carrinho com itens", async () => {
    await fillCart();
    const noKey = await placeOrder(undefined);
    expect(noKey.status).toBe(400);
    expect((await noKey.json()).error.code).toBe("idempotency_key_required");

    const disconnected = await placeOrder("k-1");
    expect(disconnected.status).toBe(422);
    expect((await disconnected.json()).error.code).toBe("wallet_not_connected");

    await patchWallet(WALLET, "connect");
    await call("/cart/items/emerald-ape-042~ed-1-50", { method: "DELETE" });
    await call("/cart/items/violet-nomad-314~ed-open", { method: "DELETE" });
    const empty = await placeOrder("k-2");
    expect((await empty.json()).error.code).toBe("cart_empty");
  });

  it("confirma, grava o snapshot e tira do carrinho só a quantidade comprada", async () => {
    await ready();
    const response = await placeOrder("k-confirm");
    expect(response.status).toBe(201);
    const order = orderSchema.parse(await response.json());
    expect(order.status).toBe("confirmed");
    expect(order.txRef).toMatch(/^0x[0-9a-f]{64}$/);
    expect(order.snapshot.items.map((item) => [item.slug, item.quantity, item.priceEth])).toEqual([
      ["emerald-ape-042", 2, "1.19"],
      ["violet-nomad-314", 1, "1.39"],
    ]);
    expect(order.snapshot.totalEth).toBe("3.79");

    const db = getDatabase();
    expect(db.carts["user-marina"].items).toEqual([]);
    expect(db.nfts.find((nft) => nft.slug === "emerald-ape-042")?.available).toBe(3);

    // O catálogo muda depois; o recibo continua com o preço gravado.
    db.nfts.find((nft) => nft.slug === "emerald-ape-042")!.priceEth = "9.99";
    const read = orderSchema.parse(await (await call(`/orders/${order.id}`)).json());
    expect(read.snapshot.items[0].priceEth).toBe("1.19");
  });

  it("repetir a chave com o mesmo corpo devolve o mesmo pedido, sem criar outro", async () => {
    await ready();
    const first = await (await placeOrder("k-same")).json();
    const again = await placeOrder("k-same");
    expect(again.headers.get("Idempotency-Replayed")).toBe("true");
    expect((await again.json()).id).toBe(first.id);
    expect(getDatabase().orders).toHaveLength(1);
  });

  it("a mesma chave com outro corpo é rejeitada", async () => {
    await ready();
    await placeOrder("k-diff");
    const other = await placeOrder("k-diff", { walletId: "wallet-marina-2" });
    expect(other.status).toBe(409);
    expect((await other.json()).error.code).toBe("idempotency_conflict");
  });

  it("payment-declined grava declined e não esvazia o carrinho", async () => {
    await ready("payment-declined");
    const order = await (await placeOrder("k-declined")).json();
    expect(order.status).toBe("declined");
    expect(order.txRef).toBeNull();
    expect(getDatabase().carts["user-marina"].items).toHaveLength(2);
    expect(getDatabase().nfts.find((nft) => nft.slug === "emerald-ape-042")?.available).toBe(5);
  });

  it("edition-sold-out responde 409 sem criar pedido", async () => {
    await ready("edition-sold-out");
    const response = await placeOrder("k-sold");
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("edition_sold_out");
    expect(getDatabase().orders).toHaveLength(0);
  });

  it("price-changed: versão 1 já vista dá quote_changed; a versão 2 passa", async () => {
    await ready("price-changed");
    const stale = await placeOrder("k-price-1");
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe("quote_changed");
    expect(getDatabase().orders).toHaveLength(0);

    const accepted = await placeOrder("k-price-2", { quoteVersion: 2 });
    expect(accepted.status).toBe(201);
    expect((await accepted.json()).snapshot).toMatchObject({ version: 2, networkFeeEth: "0.03", totalEth: "3.80" });
  });

  it("order-timeout: primeira chamada espera e falha na rede, o retry devolve o pedido pendente", async () => {
    await ready("order-timeout");
    await expect(placeOrder("k-timeout")).rejects.toThrow();

    const db = getDatabase();
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].status).toBe("pending");
    expect(db.carts["user-marina"].items).toHaveLength(2);

    const retry = await placeOrder("k-timeout");
    const order = await retry.json();
    expect(order).toMatchObject({ id: db.orders[0].id, status: "pending" });
    expect(db.orders).toHaveLength(1);

    // Leitura 1 ainda pendente; leitura 2 confirma e tira os itens do carrinho.
    expect((await (await call(`/orders/${order.id}`)).json()).status).toBe("pending");
    expect(getDatabase().carts["user-marina"].items).toHaveLength(2);
    expect((await (await call(`/orders/${order.id}`)).json()).status).toBe("confirmed");
    expect(getDatabase().carts["user-marina"].items).toEqual([]);
  });

  it("não deixa ler o pedido de outro usuário", async () => {
    await ready();
    const order = await (await placeOrder("k-owner")).json();
    const login = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rafael@kurio.test", password: "Rafael#2026" }),
    });
    const other = (await login.json()).token;
    const response = await fetch(`${base}/orders/${order.id}`, { headers: { Authorization: `Bearer ${other}` } });
    expect(response.status).toBe(404);
  });
});
