import { http, HttpResponse } from "msw";
import type { Quote } from "@/shared/domain/contracts";
import { addEth, mulEth, subEth } from "@/shared/domain/money";
import { findNftBySlug } from "./nfts";

/** Taxa de rede fixa do seed, em ETH. */
export const NETWORK_FEE_ETH = "0.02";

const COUPONS: Record<string, string> = {
  GENESIS10: "0.10",
  DROP5: "0.05",
};
const EXPIRED_COUPONS = new Set(["VENCIDO"]);

export type CouponResult = { ok: true; rate: string } | { ok: false; reason: "invalid" | "expired" };

/** Regra de cupom do mock. Compara sem diferenciar maiúsculas nem espaços nas pontas. */
export function applyCoupon(code: string): CouponResult {
  const normalized = code.trim().toUpperCase();
  if (EXPIRED_COUPONS.has(normalized)) return { ok: false, reason: "expired" };
  const rate = COUPONS[normalized];
  return rate ? { ok: true, rate } : { ok: false, reason: "invalid" };
}

function errorResponse(status: number, code: string, message: string, fields?: Record<string, string>) {
  return HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

type QuoteItem = { slug: string; quantity: number };

function readItems(raw: unknown): QuoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): QuoteItem[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { slug, quantity } = entry as Record<string, unknown>;
    if (typeof slug !== "string" || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return [];
    }
    return [{ slug, quantity }];
  });
}

/**
 * `POST /api/quote`: visitante e usuário logado recebem cotação. O preço vem do catálogo,
 * não do cliente. Cupom inválido ou expirado responde 422 e não aplica desconto.
 */
export const quoteHandlers = [
  http.post("/api/quote", async ({ request }) => {
    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (typeof parsed === "object" && parsed !== null) body = parsed as Record<string, unknown>;
    } catch {
      // corpo ausente ou inválido cai em carrinho vazio sem cupom
    }

    const subtotalEth = readItems(body.items).reduce((sum, item) => {
      const nft = findNftBySlug(item.slug);
      return nft ? addEth(sum, mulEth(nft.priceEth, item.quantity)) : sum;
    }, "0");

    let rate = "0";
    const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim() : "";
    if (couponCode !== "") {
      const coupon = applyCoupon(couponCode);
      if (!coupon.ok) {
        const expired = coupon.reason === "expired";
        const message = expired ? "Este cupom expirou." : "Cupom inválido.";
        return errorResponse(422, expired ? "coupon_expired" : "coupon_invalid", message, { couponCode: message });
      }
      rate = coupon.rate;
    }

    const discountEth = mulEth(subtotalEth, Number(rate));
    const quote: Quote = {
      subtotalEth,
      discountEth,
      networkFeeEth: NETWORK_FEE_ETH,
      totalEth: addEth(subEth(subtotalEth, discountEth), NETWORK_FEE_ETH),
      version: 1,
    };
    return HttpResponse.json(quote);
  }),
];
