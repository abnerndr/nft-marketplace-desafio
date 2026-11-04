import type { QueryClient } from "@tanstack/react-query";
import { io, WebSocket as EngineWebSocket } from "socket.io-client";
import { z } from "zod";
import { captureSessionIdentity, isCurrentSession, privateQueryKey } from "@/features/auth/session-identity";
import { cartQueryKey } from "@/features/cart/api";
import { quoteQueryKey } from "@/features/cart/quote";
import { orderQueryKey } from "@/features/orders/api";
import { orderStatusSchema, type CartLine, type CartView, type NftDetail, type Order, type OrderStatus } from "@/shared/domain/contracts";
import type { NftList } from "@/features/catalog/api";
import { pushPriceNotice } from "./notices";

export const DEFAULT_SOCKET_URL = "wss://realtime.kurio.local";

export function socketUrl(): string {
  const configured = import.meta.env.VITE_SOCKET_URL;
  return typeof configured === "string" && configured !== "" ? configured : DEFAULT_SOCKET_URL;
}

/** Só aplica o que é mais novo que o estado local: duplicata e versão antiga não regridem nada. */
export function shouldApplyVersion(current: number | undefined, incoming: number): boolean {
  return current === undefined || incoming > current;
}

/** O pedido não carrega versão própria: `pending` é a 1, estados finais são a 2. */
export function orderVersion(status: OrderStatus): number {
  return status === "pending" ? 1 : 2;
}

const baseEvent = {
  eventId: z.string().min(1),
  version: z.number().int(),
  /** Sessão dona do evento. Ausente vale para qualquer sessão; presente e diferente do usuário atual, ignora. */
  userId: z.string().optional(),
};

export const nftUpdatedSchema = z.object({
  ...baseEvent,
  resource: z.object({
    slug: z.string(),
    priceEth: z.string(),
    available: z.number().int().nonnegative().optional(),
  }),
});

export const orderUpdatedSchema = z.object({
  ...baseEvent,
  resource: z.object({
    id: z.string(),
    status: orderStatusSchema,
    txRef: z.string().nullable().optional(),
  }),
});

export type NftUpdatedEvent = z.infer<typeof nftUpdatedSchema>;
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedSchema>;

export const NFT_UPDATED = "nft.updated";
export const ORDER_UPDATED = "order.updated";

const SEEN_LIMIT = 200;

type PriceSnapshot = { title: string; priceEth: string; version: number | undefined };

function cartSnapshots(client: QueryClient, slug: string, userId?: string): PriceSnapshot[] {
  const found: PriceSnapshot[] = [];
  const carts = [
    ...client.getQueriesData<CartView | CartLine[]>({ queryKey: cartQueryKey }),
    ...(userId ? client.getQueriesData<CartView | CartLine[]>({ queryKey: privateQueryKey(userId, "cart") }) : []),
  ];
  for (const [, cart] of carts) {
    const lines = Array.isArray(cart) ? cart : cart?.items;
    const line = lines?.find((candidate) => candidate.slug === slug);
    if (line) found.push({ title: line.title, priceEth: line.priceEth, version: line.priceVersion });
  }
  return found;
}

/** Cada cache que guarda o NFT: o dado de cada lugar, no formato dele. */
function cachedSnapshots(client: QueryClient, slug: string, userId?: string): PriceSnapshot[] {
  const found: PriceSnapshot[] = [];
  const detail = client.getQueryData<NftDetail>(["nft", slug]);
  if (detail) found.push({ title: detail.title, priceEth: detail.priceEth, version: detail.priceVersion });
  for (const [, list] of client.getQueriesData<NftList>({ queryKey: ["nfts"] })) {
    const item = list?.items.find((candidate) => candidate.slug === slug);
    if (item) found.push({ title: item.title, priceEth: item.priceEth, version: item.priceVersion });
  }
  found.push(...cartSnapshots(client, slug, userId));
  return found;
}

/** Maior versão de preço que algum cache já mostra para o NFT. Sobrevive à recarga: vem do servidor. */
export function cachedPriceVersion(client: QueryClient, slug: string, userId?: string): number | undefined {
  const versions = cachedSnapshots(client, slug, userId).flatMap((snapshot) => snapshot.version ?? 1);
  return versions.length > 0 ? Math.max(...versions) : undefined;
}

function findPrice(client: QueryClient, slug: string, userId?: string): PriceSnapshot | null {
  return cachedSnapshots(client, slug, userId)[0] ?? null;
}

function patchCartPrices(client: QueryClient, queryKey: readonly unknown[], slug: string, priceEth: string, version: number) {
  client.setQueriesData<CartView | CartLine[]>({ queryKey }, (old) => {
    const patchLine = (line: CartLine): CartLine => (line.slug === slug ? { ...line, priceEth, priceVersion: version } : line);
    if (Array.isArray(old)) return old.map(patchLine);
    return old ? { ...old, items: old.items.map(patchLine) } : old;
  });
}

function applyNftUpdate(client: QueryClient, event: NftUpdatedEvent, userId?: string): void {
  const { slug, priceEth, available } = event.resource;
  const before = findPrice(client, slug, userId);
  const patch = { priceEth, priceVersion: event.version, ...(available === undefined ? {} : { available }) };

  client.setQueryData<NftDetail>(["nft", slug], (old) => (old ? { ...old, ...patch } : old));
  client.setQueriesData<NftList>({ queryKey: ["nfts"] }, (old) =>
    old ? { ...old, items: old.items.map((item) => (item.slug === slug ? { ...item, ...patch } : item)) } : old,
  );
  patchCartPrices(client, cartQueryKey, slug, priceEth, event.version);
  if (userId) patchCartPrices(client, privateQueryKey(userId, "cart"), slug, priceEth, event.version);
  // Carrinho e cotação vêm do servidor: refaz para o resumo e a próxima `version` acompanharem o preço.
  void client.invalidateQueries({ queryKey: cartQueryKey });
  void client.invalidateQueries({ queryKey: quoteQueryKey });
  if (userId) {
    void client.invalidateQueries({ queryKey: privateQueryKey(userId, "cart") });
    void client.invalidateQueries({ queryKey: privateQueryKey(userId, "quote") });
  }

  if (before && before.priceEth !== priceEth) {
    pushPriceNotice({
      eventId: event.eventId,
      slug,
      title: before.title,
      fromEth: before.priceEth,
      toEth: priceEth,
    });
  }
}

function applyOrderUpdate(client: QueryClient, event: OrderUpdatedEvent, known: number | undefined, userId: string): void {
  const { id, status, txRef } = event.resource;
  client.setQueryData<Order>(orderQueryKey(userId, id), (old) => {
    if (!old) return old;
    const current = Math.max(known ?? 0, orderVersion(old.status));
    if (!shouldApplyVersion(current, event.version)) return old;
    return { ...old, status, txRef: txRef ?? old.txRef };
  });
  // Pedido confirmado baixa o carrinho e o estoque.
  void client.invalidateQueries({ queryKey: privateQueryKey(userId, "cart") });
}

/**
 * O engine.io-client guarda `globalThis.WebSocket` quando o módulo carrega. Com mocks, o MSW troca
 * esse construtor depois, ao iniciar o worker, e o socket abriria uma conexão de verdade. Resolver
 * o construtor na hora de conectar mantém a conexão sob o MSW e não muda nada em produção.
 */
class LiveWebSocket extends EngineWebSocket {
  override createSocket(uri: string, protocols: string | string[] | undefined): WebSocket {
    return protocols ? new globalThis.WebSocket(uri, protocols) : new globalThis.WebSocket(uri);
  }
}

export type RealtimeOptions = {
  /** Ausente no visitante: o handshake vai sem `auth.token`. */
  token?: string;
  /** Ausente no visitante: eventos com `userId` de outra sessão são ignorados. */
  userId?: string;
  client: QueryClient;
};

/**
 * Abre o Socket.IO e liga os dois eventos. Devolve o cleanup: tira os listeners e fecha o
 * socket. Cada chamada tem seus próprios `eventId` e versões vistas, então trocar de usuário
 * nunca herda estado do socket anterior. Visitante também conecta, sem token, para receber
 * `nft.updated` público no catálogo e no carrinho.
 */
export function connectRealtime({ token, userId, client }: RealtimeOptions): () => void {
  const identity = captureSessionIdentity();
  const socket = io(socketUrl(), {
    auth: token ? { token } : {},
    transportImplementations: [LiveWebSocket],
  });
  const seen = new Set<string>();
  const versions = new Map<string, number>();
  let connectedBefore = false;

  function accept(event: { eventId: string; userId?: string }): boolean {
    if (!isCurrentSession(identity)) return false;
    if (event.userId !== undefined && event.userId !== userId) return false;
    if (seen.has(event.eventId)) return false;
    seen.add(event.eventId);
    if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value as string);
    return true;
  }

  function onNftUpdated(payload: unknown) {
    const parsed = nftUpdatedSchema.safeParse(payload);
    if (!parsed.success || !accept(parsed.data)) return;
    const { slug } = parsed.data.resource;
    const key = `nft:${slug}`;
    // Vale o maior entre o que este socket viu e o que o cache já mostra (que vem do servidor).
    const current = Math.max(versions.get(key) ?? 0, cachedPriceVersion(client, slug, userId) ?? 0) || undefined;
    if (!shouldApplyVersion(current, parsed.data.version)) return;
    versions.set(key, parsed.data.version);
    applyNftUpdate(client, parsed.data, userId);
  }

  function onOrderUpdated(payload: unknown) {
    const parsed = orderUpdatedSchema.safeParse(payload);
    if (!parsed.success || !accept(parsed.data)) return;
    const key = `order:${parsed.data.resource.id}`;
    const known = versions.get(key);
    if (!userId || !shouldApplyVersion(known, parsed.data.version)) return;
    versions.set(key, parsed.data.version);
    applyOrderUpdate(client, parsed.data, known, userId);
  }

  function onConnect() {
    // Callback do socket anterior não pode religar leitura da conta que já saiu.
    if (!isCurrentSession(identity)) return;
    // Depois de uma queda o cliente pode ter perdido eventos: pergunta de novo ao servidor.
    // Pedido pendente volta a `GET /api/orders/:id`; nada cria pedido novo.
    if (connectedBefore) {
      void client.invalidateQueries({ queryKey: ["nfts"] });
      void client.invalidateQueries({ queryKey: ["nft"] });
      void client.invalidateQueries({ queryKey: cartQueryKey });
      void client.invalidateQueries({ queryKey: quoteQueryKey });
      if (userId) {
        void client.invalidateQueries({ queryKey: privateQueryKey(userId, "cart") });
        void client.invalidateQueries({ queryKey: privateQueryKey(userId, "quote") });
        void client.invalidateQueries({ queryKey: privateQueryKey(userId, "order") });
      }
    }
    connectedBefore = true;
  }

  socket.on("connect", onConnect);
  socket.on(NFT_UPDATED, onNftUpdated);
  socket.on(ORDER_UPDATED, onOrderUpdated);

  return () => {
    socket.off("connect", onConnect);
    socket.off(NFT_UPDATED, onNftUpdated);
    socket.off(ORDER_UPDATED, onOrderUpdated);
    socket.close();
  };
}
