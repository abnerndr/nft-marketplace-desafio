import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/shared/api/client";
import { queryClient } from "@/shared/api/query-client";
import { initMockState } from "@/mocks/db";
import { applyScenario } from "@/mocks/scenarios";
import { nftHandlers } from "@/mocks/handlers/nfts";
import { scenarioHandlers } from "@/mocks/handlers/scenario";
import { addGuestItem, GUEST_CART_KEY, parseGuestItems, restoreGuestItems } from "./guest-cart";
import { loadGuestLines } from "./api";

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

const server = setupServer(...scenarioHandlers, ...nftHandlers);

describe("linhas do carrinho de visitante", () => {
  beforeAll(() => {
    api.defaults.baseURL = "http://kurio.test/api";
    server.listen({ onUnhandledFrame: "error" });
  });
  beforeEach(() => {
    vi.stubGlobal("location", new URL("http://kurio.test/"));
    vi.stubGlobal("localStorage", memoryStorage());
    initMockState("?reset=1");
    queryClient.clear();
  });
  afterEach(() => {
    applyScenario("default");
    vi.unstubAllGlobals();
  });
  afterAll(() => server.close());

  it("monta a linha com o detalhe atual do NFT", async () => {
    addGuestItem({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 2 });
    const lines = await loadGuestLines(localStorage.getItem(GUEST_CART_KEY) ?? "");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      slug: "emerald-ape-042",
      editionId: "ed-1-50",
      quantity: 2,
      title: "Emerald Ape #042",
      priceEth: "1.19",
    });
  });

  it("só um 404 remove a linha; o restante do carrinho continua", async () => {
    restoreGuestItems([
      { slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1 },
      { slug: "nft-que-nao-existe", editionId: "ed-1-50", quantity: 1 },
    ]);
    const lines = await loadGuestLines(localStorage.getItem(GUEST_CART_KEY) ?? "");
    expect(lines.map((line) => line.slug)).toEqual(["emerald-ape-042"]);
    expect(parseGuestItems(localStorage.getItem(GUEST_CART_KEY) ?? "").map((item) => item.slug)).toEqual([
      "emerald-ape-042",
    ]);
  });

  it("falha transitória não esvazia o carrinho: os itens permanecem guardados", async () => {
    addGuestItem({ slug: "sage-nomad-009", editionId: "ed-1-50", quantity: 1 });
    applyScenario("offline");
    await expect(loadGuestLines(localStorage.getItem(GUEST_CART_KEY) ?? "")).rejects.toBeTruthy();
    expect(parseGuestItems(localStorage.getItem(GUEST_CART_KEY) ?? "")).toEqual([
      { slug: "sage-nomad-009", editionId: "ed-1-50", quantity: 1 },
    ]);
  });
});
