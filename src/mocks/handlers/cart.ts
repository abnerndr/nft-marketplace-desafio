import { http, HttpResponse } from "msw";
import type { CartLine } from "@/shared/domain/contracts";
import { getDatabase, saveDatabase } from "../db";
import { userFromRequest } from "./auth";
import { editionsOf, findNftBySlug, tokenIdOf } from "./nfts";

const SEPARATOR = "~";

function errorResponse(status: number, code: string, message: string, fields?: Record<string, string>) {
  return HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

function unauthorized() {
  return errorResponse(401, "unauthorized", "Entre para usar o carrinho.");
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function lineId(slug: string, editionId: string): string {
  return `${slug}${SEPARATOR}${editionId}`;
}

function parseLineId(id: string): { slug: string; editionId: string } | null {
  const at = id.lastIndexOf(SEPARATOR);
  if (at <= 0) return null;
  return { slug: id.slice(0, at), editionId: id.slice(at + 1) };
}

function isValidQuantity(quantity: unknown): quantity is number {
  return typeof quantity === "number" && Number.isInteger(quantity) && quantity >= 1;
}

const QUANTITY_ERROR = "Informe uma quantidade inteira a partir de 1.";

function overStock(available: number) {
  return errorResponse(409, "conflict", `Só há ${available} unidade(s) disponível(is).`);
}

function cartOf(userId: string) {
  const db = getDatabase();
  db.carts[userId] ??= { items: [], couponCode: null };
  return db.carts[userId];
}

/** Monta a linha de exibição; `null` quando o NFT ou a edição deixaram de existir. */
function toLine(item: { slug: string; editionId: string; quantity: number }): CartLine | null {
  const nft = findNftBySlug(item.slug);
  const edition = nft ? editionsOf(nft).find((candidate) => candidate.id === item.editionId) : undefined;
  if (!nft || !edition) return null;
  return {
    id: lineId(item.slug, item.editionId),
    slug: item.slug,
    editionId: item.editionId,
    quantity: item.quantity,
    editionLabel: edition.label,
    available: edition.available,
    title: nft.title,
    tokenId: tokenIdOf(nft.slug),
    imageUrl: nft.imageUrl,
    priceEth: nft.priceEth,
  };
}

/**
 * Carrinho do usuário logado. O estoque de cada edição é independente (`editionsOf`).
 * Quantidade acima do disponível responde 409 `conflict`, sem cortar em silêncio.
 */
export const cartHandlers = [
  http.get("/api/cart", ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const cart = cartOf(user.id);
    const items = cart.items.flatMap((item) => toLine(item) ?? []);
    return HttpResponse.json({ items, couponCode: cart.couponCode });
  }),

  http.post("/api/cart/items", async ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const body = await readBody(request);
    const slug = typeof body.slug === "string" ? body.slug : "";
    const editionId = typeof body.editionId === "string" ? body.editionId : "";
    const quantity = body.quantity;

    const nft = findNftBySlug(slug);
    if (!nft) return errorResponse(404, "not_found", "NFT não encontrado.");

    const edition = editionsOf(nft).find((candidate) => candidate.id === editionId);
    if (!edition) return errorResponse(422, "validation", "Edição inválida.", { editionId: "Edição inválida." });

    if (!isValidQuantity(quantity)) {
      return errorResponse(422, "validation", QUANTITY_ERROR, { quantity: QUANTITY_ERROR });
    }
    if (edition.available === 0) {
      return errorResponse(409, "edition_sold_out", "Esta edição está esgotada.");
    }

    const cart = cartOf(user.id);
    const existing = cart.items.find((item) => item.slug === slug && item.editionId === editionId);
    const total = (existing?.quantity ?? 0) + quantity;
    if (total > edition.available) return overStock(edition.available);

    if (existing) {
      existing.quantity = total;
    } else {
      cart.items.push({ slug, editionId, quantity });
    }
    saveDatabase();

    return HttpResponse.json(
      { item: cart.items.find((item) => item.slug === slug && item.editionId === editionId) },
      { status: 201 },
    );
  }),

  http.patch("/api/cart/items/:id", async ({ request, params }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const target = parseLineId(decodeURIComponent(String(params.id)));
    const item = target
      ? cartOf(user.id).items.find((candidate) => candidate.slug === target.slug && candidate.editionId === target.editionId)
      : undefined;
    if (!item) return errorResponse(404, "not_found", "Item não encontrado no carrinho.");

    const { quantity } = await readBody(request);
    if (!isValidQuantity(quantity)) {
      return errorResponse(422, "validation", QUANTITY_ERROR, { quantity: QUANTITY_ERROR });
    }

    const nft = findNftBySlug(item.slug);
    const edition = nft ? editionsOf(nft).find((candidate) => candidate.id === item.editionId) : undefined;
    const available = edition?.available ?? 0;
    if (quantity > available) return overStock(available);

    item.quantity = quantity;
    saveDatabase();
    return HttpResponse.json({ item });
  }),

  http.delete("/api/cart/items/:id", ({ request, params }) => {
    const user = userFromRequest(request);
    if (!user) return unauthorized();

    const target = parseLineId(decodeURIComponent(String(params.id)));
    const cart = cartOf(user.id);
    const index = target
      ? cart.items.findIndex((candidate) => candidate.slug === target.slug && candidate.editionId === target.editionId)
      : -1;
    if (index === -1) return errorResponse(404, "not_found", "Item não encontrado no carrinho.");

    cart.items.splice(index, 1);
    saveDatabase();
    return new HttpResponse(null, { status: 204 });
  }),
];
