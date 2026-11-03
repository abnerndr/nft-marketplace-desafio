import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartView, NftDetail, NftSummary, Order } from "@/shared/domain/contracts";

type Listener = (...args: unknown[]) => void;

/** Socket.IO falso: guarda os listeners e deixa o teste disparar eventos. Nenhuma rede é aberta. */
class FakeSocket {
  listeners = new Map<string, Set<Listener>>();
  closed = false;

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  close() {
    this.closed = true;
  }

  count(event: string) {
    return this.listeners.get(event)?.size ?? 0;
  }

  receive(event: string, payload?: unknown) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(payload);
  }
}

const mocks = vi.hoisted(() => ({ sockets: [] as unknown[], io: vi.fn() }));

vi.mock("socket.io-client", () => {
  mocks.io.mockImplementation(() => {
    const socket = new FakeSocket();
    mocks.sockets.push(socket);
    return socket;
  });
  return { io: mocks.io, WebSocket: class {} };
});

import { cartQueryKey } from "@/features/cart/api";
import { orderQueryKey } from "@/features/orders/api";
import { clearPriceNotices, getPriceNotices } from "./notices";
import { dropPrivateCache, shouldDropPrivateCache } from "./private-cache";
import { cachedPriceVersion, connectRealtime } from "./socket";

const sockets = () => mocks.sockets as FakeSocket[];

function summary(overrides: Partial<NftSummary> = {}): NftSummary {
  return {
    id: "nft-1",
    slug: "emerald-ape-042",
    title: "Emerald Ape #042",
    collection: "digital-art",
    network: "ethereum",
    priceEth: "1.19",
    compareAtEth: null,
    available: 5,
    imageUrl: "/nfts/a.svg",
    ...overrides,
  };
}

function nftEvent(eventId: string, version: number, priceEth: string, userId?: string) {
  return { eventId, version, ...(userId ? { userId } : {}), resource: { slug: "emerald-ape-042", priceEth } };
}

function order(status: Order["status"]): Order {
  return {
    id: "order-1",
    status,
    txRef: null,
    createdAt: "2026-11-03T12:00:00.000Z",
    wallet: { label: "Principal", address: "0x1", network: "ethereum" },
    snapshot: { subtotalEth: "1", discountEth: "0", networkFeeEth: "0.02", totalEth: "1.02", version: 1, items: [], couponCode: null },
  };
}

const listKey = ["nfts", { page: 1 }] as const;

function priceInList(client: QueryClient) {
  return client.getQueryData<{ items: NftSummary[] }>(listKey)?.items[0];
}

let client: QueryClient;

beforeEach(() => {
  mocks.sockets.length = 0;
  mocks.io.mockClear();
  client = new QueryClient();
  client.setQueryData(listKey, { items: [summary()], page: 1, pageSize: 9, total: 1, facets: { collection: {}, network: {} } });
  clearPriceNotices();
});

afterEach(() => {
  client.clear();
});

describe("connectRealtime", () => {
  it("conecta com o token em auth", () => {
    connectRealtime({ token: "tok", userId: "user-marina", client });
    expect(mocks.io).toHaveBeenCalledTimes(1);
    expect(mocks.io.mock.calls[0][1]).toMatchObject({ auth: { token: "tok" } });
  });

  it("aplica nft.updated e guarda a versão no cache", () => {
    connectRealtime({ token: "tok", userId: "user-marina", client });
    sockets()[0].receive("nft.updated", nftEvent("e1", 2, "1.31"));
    expect(priceInList(client)).toMatchObject({ priceEth: "1.31", priceVersion: 2 });
  });

  it("ignora evento de outro userId", () => {
    connectRealtime({ token: "tok", userId: "user-marina", client });
    sockets()[0].receive("nft.updated", nftEvent("e1", 2, "9.99", "user-rafael"));
    expect(priceInList(client)?.priceEth).toBe("1.19");
  });

  it("ignora eventId repetido", () => {
    connectRealtime({ token: "tok", userId: "user-marina", client });
    const socket = sockets()[0];
    socket.receive("nft.updated", nftEvent("e1", 2, "1.31"));
    // Mesmo eventId com versão maior: já foi visto, então não vale.
    socket.receive("nft.updated", nftEvent("e1", 3, "5.00"));
    expect(priceInList(client)).toMatchObject({ priceEth: "1.31", priceVersion: 2 });
  });

  it("não regride o preço com versão igual ou antiga", () => {
    connectRealtime({ token: "tok", userId: "user-marina", client });
    const socket = sockets()[0];
    socket.receive("nft.updated", nftEvent("e1", 3, "1.40"));
    socket.receive("nft.updated", nftEvent("e2", 3, "0.10"));
    socket.receive("nft.updated", nftEvent("e3", 2, "0.20"));
    expect(priceInList(client)?.priceEth).toBe("1.40");
  });

  it("não regride depois de recarregar: a versão vem do NFT que o servidor devolveu", () => {
    // Página recarregada: socket novo, mapa de versões vazio, cache já com versão 4 do servidor.
    client.setQueryData(listKey, {
      items: [summary({ priceEth: "1.60", priceVersion: 4 })],
      page: 1,
      pageSize: 9,
      total: 1,
      facets: { collection: {}, network: {} },
    });
    connectRealtime({ token: "tok", userId: "user-marina", client });
    const socket = sockets()[0];
    socket.receive("nft.updated", nftEvent("old", 2, "1.31"));
    socket.receive("nft.updated", nftEvent("same", 4, "0.50"));
    expect(priceInList(client)).toMatchObject({ priceEth: "1.60", priceVersion: 4 });
    socket.receive("nft.updated", nftEvent("new", 5, "1.76"));
    expect(priceInList(client)).toMatchObject({ priceEth: "1.76", priceVersion: 5 });
  });

  it("lê a versão do detalhe e do carrinho em cache", () => {
    client.setQueryData<NftDetail>(["nft", "emerald-ape-042"], { ...summary({ priceVersion: 3 }) } as NftDetail);
    expect(cachedPriceVersion(client, "emerald-ape-042")).toBe(3);
    expect(cachedPriceVersion(client, "outro")).toBeUndefined();
  });

  it("order.updated antigo não regride o status", () => {
    client.setQueryData(orderQueryKey("order-1"), order("confirmed"));
    connectRealtime({ token: "tok", userId: "user-marina", client });
    const socket = sockets()[0];
    socket.receive("order.updated", { eventId: "o1", version: 1, resource: { id: "order-1", status: "pending", txRef: null } });
    expect(client.getQueryData<Order>(orderQueryKey("order-1"))?.status).toBe("confirmed");
    // Estado final diferente na mesma versão também não troca o que já é final.
    socket.receive("order.updated", { eventId: "o2", version: 2, resource: { id: "order-1", status: "declined", txRef: null } });
    expect(client.getQueryData<Order>(orderQueryKey("order-1"))?.status).toBe("confirmed");
  });

  it("order.updated mais novo atualiza o pedido pendente", () => {
    client.setQueryData(orderQueryKey("order-1"), order("pending"));
    connectRealtime({ token: "tok", userId: "user-marina", client });
    sockets()[0].receive("order.updated", { eventId: "o1", version: 2, resource: { id: "order-1", status: "confirmed", txRef: "0xabc" } });
    expect(client.getQueryData<Order>(orderQueryKey("order-1"))).toMatchObject({ status: "confirmed", txRef: "0xabc" });
  });

  it("remove os listeners e fecha o socket no cleanup", () => {
    const cleanup = connectRealtime({ token: "tok", userId: "user-marina", client });
    const socket = sockets()[0];
    expect(socket.count("nft.updated")).toBe(1);
    expect(socket.count("order.updated")).toBe(1);
    expect(socket.count("connect")).toBe(1);

    cleanup();

    expect(socket.count("nft.updated")).toBe(0);
    expect(socket.count("order.updated")).toBe(0);
    expect(socket.count("connect")).toBe(0);
    expect(socket.closed).toBe(true);
    socket.receive("nft.updated", nftEvent("late", 9, "9.99"));
    expect(priceInList(client)?.priceEth).toBe("1.19");
  });
});

describe("troca de usuário", () => {
  it("fecha o socket anterior e abre outro para o novo usuário", () => {
    const first = connectRealtime({ token: "a", userId: "user-marina", client });
    first();
    connectRealtime({ token: "b", userId: "user-rafael", client });
    expect(sockets()).toHaveLength(2);
    expect(sockets()[0].closed).toBe(true);
    expect(sockets()[1].closed).toBe(false);
    expect(mocks.io.mock.calls[1][1]).toMatchObject({ auth: { token: "b" } });
  });

  it("só descarta cache quando havia um usuário e ele mudou", () => {
    expect(shouldDropPrivateCache(undefined, "user-marina")).toBe(false);
    expect(shouldDropPrivateCache("user-marina", "user-marina")).toBe(false);
    expect(shouldDropPrivateCache("user-marina", "user-rafael")).toBe(true);
    expect(shouldDropPrivateCache("user-marina", undefined)).toBe(true);
  });

  it("descarta carrinho, cotação, pedidos, carteiras e favoritos da sessão anterior e mantém o catálogo", () => {
    const cart: CartView = { items: [], couponCode: null };
    client.setQueryData([...cartQueryKey, "server"], cart);
    client.setQueryData(["quote", "checkout"], { version: 1 });
    client.setQueryData(orderQueryKey("order-1"), order("confirmed"));
    client.setQueryData(["wallets"], []);
    client.setQueryData(["favorites", "user-marina"], ["emerald-ape-042"]);
    client.setQueryData(["session"], { id: "user-marina" });

    dropPrivateCache(client);

    expect(client.getQueryData([...cartQueryKey, "server"])).toBeUndefined();
    expect(client.getQueryData(["quote", "checkout"])).toBeUndefined();
    expect(client.getQueryData(orderQueryKey("order-1"))).toBeUndefined();
    expect(client.getQueryData(["wallets"])).toBeUndefined();
    expect(client.getQueryData(["favorites", "user-marina"])).toBeUndefined();
    expect(priceInList(client)).toBeDefined();
  });
});

describe("aviso de mudança de preço", () => {
  it("aparece quando só o carrinho está carregado", () => {
    client.removeQueries({ queryKey: ["nfts"] });
    const cart: CartView = {
      couponCode: null,
      items: [
        {
          id: "emerald-ape-042~ed-open",
          slug: "emerald-ape-042",
          editionId: "ed-open",
          quantity: 1,
          editionLabel: "ABERTA",
          available: 5,
          title: "Emerald Ape #042",
          tokenId: "#0042",
          imageUrl: "/nfts/a.svg",
          priceEth: "1.19",
        },
      ],
    };
    client.setQueryData([...cartQueryKey, "server"], cart);
    connectRealtime({ token: "tok", userId: "user-marina", client });

    sockets()[0].receive("nft.updated", nftEvent("e1", 2, "1.31"));

    expect(getPriceNotices()).toEqual([
      { eventId: "e1", slug: "emerald-ape-042", title: "Emerald Ape #042", fromEth: "1.19", toEth: "1.31" },
    ]);
    expect(client.getQueryData<CartView>([...cartQueryKey, "server"])?.items[0]).toMatchObject({
      priceEth: "1.31",
      priceVersion: 2,
    });
  });
});
