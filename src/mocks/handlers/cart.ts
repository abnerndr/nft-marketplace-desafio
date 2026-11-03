import { http, HttpResponse } from "msw";
import { getDatabase, saveDatabase } from "../db";
import { userFromRequest } from "./auth";
import { editionsOf, findNftBySlug } from "./nfts";

function errorResponse(status: number, code: string, message: string, fields?: Record<string, string>) {
  return HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * POST mínimo da Task 7: valida o item e o guarda no carrinho do usuário.
 * A Task 9 completa o carrinho (leitura, cupom, cotação) sobre esta mesma rota.
 */
export const cartHandlers = [
  http.post("/api/cart/items", async ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return errorResponse(401, "unauthorized", "Entre para adicionar ao carrinho.");

    const body = await readBody(request);
    const slug = typeof body.slug === "string" ? body.slug : "";
    const editionId = typeof body.editionId === "string" ? body.editionId : "";
    const quantity = body.quantity;

    const nft = findNftBySlug(slug);
    if (!nft) return errorResponse(404, "not_found", "NFT não encontrado.");

    const edition = editionsOf(nft).find((candidate) => candidate.id === editionId);
    if (!edition) return errorResponse(422, "validation", "Edição inválida.", { editionId: "Edição inválida." });

    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return errorResponse(422, "validation", "Informe uma quantidade inteira a partir de 1.", {
        quantity: "Informe uma quantidade inteira a partir de 1.",
      });
    }
    if (edition.available === 0) {
      return errorResponse(409, "edition_sold_out", "Esta edição está esgotada.");
    }
    if (quantity > edition.available) {
      return errorResponse(422, "validation", `Só há ${edition.available} unidade(s) disponível(is).`, {
        quantity: `Só há ${edition.available} unidade(s) disponível(is).`,
      });
    }

    const db = getDatabase();
    db.carts[user.id] ??= { items: [], couponCode: null };
    const cart = db.carts[user.id];
    const existing = cart.items.find((item) => item.slug === slug && item.editionId === editionId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, edition.available);
    } else {
      cart.items.push({ slug, editionId, quantity });
    }
    saveDatabase();

    return HttpResponse.json(
      { item: cart.items.find((item) => item.slug === slug && item.editionId === editionId) },
      { status: 201 },
    );
  }),
];
