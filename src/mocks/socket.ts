import { toSocketIo } from "@mswjs/socket.io-binding";
import { ws } from "msw";
import { readGuestItems } from "@/features/cart/guest-cart";
import { nftUpdatedSchema, socketUrl, type NftUpdatedEvent, type OrderUpdatedEvent } from "@/features/realtime/socket";
import { getDatabase, saveDatabase } from "./db";
import { applyPriceChange, nftVersionOf, raisedPrice } from "./nft-version";
import { getScenario } from "./scenarios";

/** Quanto o cenário `price-changed` espera antes de empurrar a mudança de preço. */
export const PRICE_CHANGE_DELAY_MS = 1500;

type Peer = {
  io: ReturnType<typeof toSocketIo>;
  /** Dono do token do handshake; `null` até o pacote de conexão chegar. */
  userId: string | null;
};

/** Conexões abertas. Vive na página: o transporte é o WebSocket do navegador interceptado pelo MSW. */
const peers = new Set<Peer>();

function socketLink() {
  return ws.link(`${socketUrl().replace(/\/+$/, "")}/*`);
}

/** O Socket.IO manda `40{"token":"..."}` ao conectar; o token vai em `auth`. */
export function tokenFromConnectPacket(data: unknown): string | null {
  if (typeof data !== "string" || !data.startsWith("40")) return null;
  try {
    const auth: unknown = JSON.parse(data.slice(2) || "{}");
    const token = typeof auth === "object" && auth !== null ? (auth as Record<string, unknown>).token : undefined;
    return typeof token === "string" && token !== "" ? token : null;
  } catch {
    return null;
  }
}

function userIdForToken(token: string | null): string | null {
  if (!token) return null;
  return getDatabase().sessions?.[token] ?? null;
}

function hasPeer(userId: string): boolean {
  return [...peers].some((peer) => peer.userId === userId);
}

function newEventId(): string {
  return `evt-${crypto.randomUUID()}`;
}

function send(type: string, payload: unknown, userId?: string): void {
  for (const peer of peers) {
    if (userId !== undefined && peer.userId !== userId) continue;
    peer.io.client.emit(type, payload);
  }
}

function priceEventForSlug(slug: string, userId?: string): NftUpdatedEvent | null {
  const nft = getDatabase().nfts.find((candidate) => candidate.slug === slug);
  if (!nft) return null;
  const version = nftVersionOf(nft.slug) + 1;
  const event: NftUpdatedEvent = {
    eventId: newEventId(),
    version,
    ...(userId ? { userId } : {}),
    resource: { slug: nft.slug, priceEth: raisedPrice(nft.priceEth) },
  };
  applyPriceChange({ slug: nft.slug, priceEth: event.resource.priceEth, version });
  return event;
}

/**
 * Sobe 10% no preço do primeiro item do carrinho do usuário e empurra `nft.updated`.
 * Devolve `null` se o carrinho está vazio.
 */
export function priceChangeForFirstCartItem(userId: string): NftUpdatedEvent | null {
  const first = getDatabase().carts[userId]?.items[0];
  if (!first) return null;
  return priceEventForSlug(first.slug, userId);
}

/** Evento público: primeiro item do carrinho de visitante, sem `userId`. */
export function priceChangeForGuestCart(): NftUpdatedEvent | null {
  const first = readGuestItems()[0];
  if (!first) return null;
  return priceEventForSlug(first.slug);
}

const scheduled = new Set<string>();

/**
 * Cenário `price-changed`: depois de um atraso, muda o preço do primeiro item do carrinho e
 * empurra `nft.updated`. Uma vez por usuário, e só conta como feito se o socket dele estava
 * aberto: sem conexão, a próxima conexão tenta de novo.
 */
export function schedulePriceChange(userId: string): void {
  if (getScenario() !== "price-changed" || scheduled.has(userId)) return;
  if (getDatabase().priceChangedFor?.includes(userId)) return;
  scheduled.add(userId);

  setTimeout(() => {
    scheduled.delete(userId);
    const db = getDatabase();
    const connected = hasPeer(userId);
    if (!connected || db.priceChangedFor?.includes(userId)) return;
    const event = priceChangeForFirstCartItem(userId);
    if (!event) return;
    db.priceChangedFor ??= [];
    db.priceChangedFor.push(userId);
    saveDatabase();
    send("nft.updated", event, userId);
  }, PRICE_CHANGE_DELAY_MS);
}

/** Avisa o dono do pedido que o estado mudou. Pedido não tem versão própria: pendente é 1, final é 2. */
export function notifyOrderUpdated(order: { id: string; status: OrderUpdatedEvent["resource"]["status"]; txRef: string | null }, userId: string): void {
  const event: OrderUpdatedEvent = {
    eventId: newEventId(),
    version: order.status === "pending" ? 1 : 2,
    userId,
    resource: { id: order.id, status: order.status, txRef: order.txRef },
  };
  send("order.updated", event, userId);
}

/**
 * `window.__kurio.emit` entra por aqui. Sem `payload`, `nft.updated` muda o preço do primeiro item
 * do carrinho de cada usuário conectado. Com `payload`, ele segue como veio para todos os sockets,
 * e o cliente decide se aplica (outra sessão, duplicata e versão antiga são ignoradas). Um
 * `nft.updated` válido, mais novo e sem dono, ou de um usuário conectado, também grava o preço
 * no banco do mock.
 */
export function emitSocketEvent(type: string, payload?: unknown): void {
  if (type === "nft.updated" && payload === undefined) {
    const users = new Set([...peers].flatMap((peer) => (peer.userId ? [peer.userId] : [])));
    for (const userId of users) {
      const event = priceChangeForFirstCartItem(userId);
      if (event) send(type, event, userId);
    }
    if ([...peers].some((peer) => peer.userId === null)) {
      const event = priceChangeForGuestCart();
      if (event) send(type, event);
    }
    return;
  }

  if (type === "nft.updated") {
    const parsed = nftUpdatedSchema.safeParse(payload);
    // Evento endereçado a uma sessão sem socket aberto só testa a entrega: não mexe no banco.
    const addressable = parsed.success && (parsed.data.userId === undefined || hasPeer(parsed.data.userId));
    if (parsed.success && addressable) {
      applyPriceChange({
        slug: parsed.data.resource.slug,
        priceEth: parsed.data.resource.priceEth,
        version: parsed.data.version,
      });
    }
  }
  send(type, payload);
}

export const socketHandlers = [
  socketLink().addEventListener("connection", (connection) => {
    const peer: Peer = { io: toSocketIo(connection as Parameters<typeof toSocketIo>[0]), userId: null };
    peers.add(peer);

    connection.client.addEventListener("message", (event) => {
      if (typeof event.data !== "string" || !event.data.startsWith("40")) return;
      const userId = userIdForToken(tokenFromConnectPacket(event.data));
      peer.userId = userId;
      // Visitante fica conectado sem `userId` e recebe `nft.updated` público.
      if (userId) schedulePriceChange(userId);
    });

    connection.client.addEventListener("close", () => {
      peers.delete(peer);
    });
  }),
];
