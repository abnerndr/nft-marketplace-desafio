import { delay, http, HttpResponse } from "msw";
import { sameOrderAttempt } from "@/features/orders/idempotency";
import type { Order, OrderItem } from "@/shared/domain/contracts";
import { getDatabase, saveDatabase } from "../db";
import { getScenario, ORDER_TIMEOUT_DELAY_MS } from "../scenarios";
import { notifyOrderUpdated } from "../socket";
import type { OrderRecord } from "../seed";
import { userFromRequest } from "./auth";
import { editionsOf, findNftBySlug, tokenIdOf } from "./nfts";
import { quoteFor } from "./quote";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";
/** No cenário `order-timeout`, o pedido pendente confirma na leitura de número `SETTLE_ON_READ`. */
const SETTLE_ON_READ = 2;

function errorResponse(status: number, code: string, message: string, fields?: Record<string, string>) {
  return HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

function unauthorized() {
  return errorResponse(401, "unauthorized", "Entre para finalizar a compra.");
}

function toOrder(record: OrderRecord): Order {
  return {
    id: record.id,
    status: record.status,
    snapshot: record.snapshot,
    txRef: record.txRef,
    wallet: record.wallet,
    createdAt: record.createdAt,
  };
}

function newTxRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** Tira do carrinho só o que foi comprado e baixa o estoque das unidades vendidas. */
function applyPurchase(record: OrderRecord): void {
  const db = getDatabase();
  const cart = (db.carts[record.userId] ??= { items: [], couponCode: null });
  for (const bought of record.snapshot.items) {
    const line = cart.items.find((item) => item.slug === bought.slug && item.editionId === bought.editionId);
    if (line) line.quantity -= bought.quantity;
    const nft = findNftBySlug(bought.slug);
    if (nft) nft.available = Math.max(0, nft.available - bought.quantity);
  }
  cart.items = cart.items.filter((item) => item.quantity > 0);
  if (cart.items.length === 0) cart.couponCode = null;
}

function confirm(record: OrderRecord): void {
  record.status = "confirmed";
  record.txRef = newTxRef();
  applyPurchase(record);
}

function readItems(userId: string): OrderItem[] {
  const cart = getDatabase().carts[userId];
  return (cart?.items ?? []).flatMap((item): OrderItem[] => {
    const nft = findNftBySlug(item.slug);
    const edition = nft ? editionsOf(nft).find((candidate) => candidate.id === item.editionId) : undefined;
    if (!nft || !edition) return [];
    return [
      {
        slug: nft.slug,
        editionId: edition.id,
        editionLabel: edition.label,
        quantity: item.quantity,
        title: nft.title,
        tokenId: tokenIdOf(nft.slug),
        imageUrl: nft.imageUrl,
        priceEth: nft.priceEth,
      },
    ];
  });
}

type OrderBody = { walletId: string; couponCode: string | null; quoteVersion: number | null };

function parseBody(raw: string): OrderBody {
  try {
    const parsed: unknown = JSON.parse(raw);
    const body = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    return {
      walletId: typeof body.walletId === "string" ? body.walletId : "",
      couponCode: typeof body.couponCode === "string" && body.couponCode !== "" ? body.couponCode : null,
      quoteVersion: typeof body.quoteVersion === "number" ? body.quoteVersion : null,
    };
  } catch {
    return { walletId: "", couponCode: null, quoteVersion: null };
  }
}

/**
 * `POST /api/orders` exige `Idempotency-Key`. A mesma chave com o mesmo corpo devolve o pedido já
 * criado; com corpo diferente responde 409 `idempotency_conflict`. O carrinho vem do servidor, o preço vem do catálogo.
 * Cenários: `payment-declined` grava `declined`; `order-timeout` grava `pending`, espera 8 s e
 * falha na rede; `edition-sold-out` esgota a edição; os demais gravam `confirmed`.
 */
export const orderHandlers = [
  http.post("/api/orders", async ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim() ?? "";
    if (key === "") {
      return errorResponse(400, "idempotency_key_required", "Envie o cabeçalho Idempotency-Key.");
    }

    const db = getDatabase();
    const rawBody = await request.text();
    const storeKey = `${user.id}:${key}`;
    db.idempotency ??= {};

    const previous = db.idempotency[storeKey];
    if (previous) {
      if (!sameOrderAttempt(previous.body, rawBody)) {
        return errorResponse(409, "idempotency_conflict", "Esta chave já foi usada em outro pedido.");
      }
      const existing = db.orders.find((order) => order.id === previous.orderId);
      if (existing) return HttpResponse.json(toOrder(existing), { headers: { "Idempotency-Replayed": "true" } });
    }

    const body = parseBody(rawBody);
    const wallet = (db.wallets[user.id] ?? []).find((candidate) => candidate.id === body.walletId);
    if (!wallet || wallet.connected !== true) {
      return errorResponse(422, "wallet_not_connected", "Conecte uma carteira para pagar.", {
        walletId: "Conecte uma carteira para pagar.",
      });
    }

    const items = readItems(user.id);
    if (items.length === 0) return errorResponse(422, "cart_empty", "Seu carrinho está vazio.");

    const cart = db.carts[user.id];
    if ((cart.couponCode ?? null) !== body.couponCode) {
      return errorResponse(409, "cart_changed", "O cupom do carrinho mudou. Revise o pedido.");
    }

    const soldOut = items.some((item) => {
      const nft = findNftBySlug(item.slug);
      const edition = nft ? editionsOf(nft).find((candidate) => candidate.id === item.editionId) : undefined;
      return !edition || item.quantity > edition.available;
    });
    if (soldOut || getScenario() === "edition-sold-out") {
      return errorResponse(409, "edition_sold_out", "Uma das edições esgotou antes do pagamento.");
    }

    const result = quoteFor(items, body.couponCode ?? "", body.quoteVersion ?? undefined);
    if (!result.ok) return errorResponse(result.status, result.code, result.message);
    if (body.quoteVersion !== result.quote.version) {
      return errorResponse(409, "quote_changed", "Os valores mudaram. Revise o pedido antes de confirmar.");
    }

    const scenario = getScenario();
    const record: OrderRecord = {
      id: `order-${crypto.randomUUID()}`,
      status: scenario === "payment-declined" ? "declined" : scenario === "order-timeout" ? "pending" : "confirmed",
      snapshot: { ...result.quote, items, couponCode: body.couponCode },
      txRef: null,
      wallet: { label: wallet.label, address: wallet.address, network: wallet.network },
      createdAt: new Date().toISOString(),
      userId: user.id,
      walletId: wallet.id,
      reads: 0,
    };
    if (record.status === "confirmed") confirm(record);
    db.orders.push(record);
    db.idempotency[storeKey] = { body: rawBody, orderId: record.id };
    saveDatabase();

    if (scenario === "order-timeout") {
      // O pedido já está gravado; só a resposta se perde. O retry com a mesma chave o devolve.
      await delay(ORDER_TIMEOUT_DELAY_MS);
      return HttpResponse.error();
    }
    return HttpResponse.json(toOrder(record), { status: 201 });
  }),

  http.get("/api/orders/:id", ({ request, params }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const record = getDatabase().orders.find((order) => order.id === params.id && order.userId === user.id);
    if (!record) return errorResponse(404, "not_found", "Pedido não encontrado.");

    if (record.status === "pending") {
      record.reads += 1;
      if (record.reads >= SETTLE_ON_READ) {
        confirm(record);
        // O servidor também empurra a mudança; o cliente ignora se já a tem.
        notifyOrderUpdated(record, user.id);
      }
      saveDatabase();
    }
    return HttpResponse.json(toOrder(record));
  }),
];
