import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { initMockState } from "../db";
import { applyScenario } from "../scenarios";
import { nftHandlers } from "./nfts";

vi.stubGlobal("location", new URL("http://kurio.test/"));

const server = setupServer(...nftHandlers);

async function list(query = "") {
  const response = await fetch(`http://kurio.test/api/nfts${query}`);
  return { status: response.status, body: await response.json() };
}

describe("GET /api/nfts", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(() => initMockState("?reset=1"));
  afterEach(() => applyScenario("default"));
  afterAll(() => server.close());

  it("pagina de 9 em 9 e devolve o total", async () => {
    const { body } = await list();
    expect(body.items).toHaveLength(9);
    expect(body.pageSize).toBe(9);
    expect(body.total).toBe(36);
  });

  it("filtra por coleções repetidas e conta as facetas depois dos outros filtros", async () => {
    const { body } = await list("?collection=music&collection=games&network=ethereum");
    expect(body.items.every((nft: { collection: string }) => ["music", "games"].includes(nft.collection))).toBe(true);
    // A faceta de coleção ignora o filtro de coleção, mas respeita o de rede.
    const all = await list("?network=ethereum");
    expect(body.facets.collection).toEqual(all.body.facets.collection);
    const networkSum = Object.values(body.facets.network as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(networkSum).toBeGreaterThan(body.total - 1);
  });

  it("ordena por preço com decimais exatos", async () => {
    const { body } = await list("?sort=price_asc&pageSize=36");
    const prices = body.items.map((nft: { priceEth: string }) => Number(nft.priceEth));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("cenário empty devolve lista vazia", async () => {
    applyScenario("empty");
    const { body } = await list();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("server-error responde 503 nas duas primeiras leituras", async () => {
    applyScenario("server-error");
    expect((await list()).status).toBe(503);
    expect((await list()).status).toBe(503);
    expect((await list()).status).toBe(200);
  });
});
