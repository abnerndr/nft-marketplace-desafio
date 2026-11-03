import { http, HttpResponse } from "msw";
import type { Quote } from "@/shared/domain/contracts";
import { addEth, mulEth, subEth } from "@/shared/domain/money";
import { maxNftVersion } from "../nft-version";
import { getScenario } from "../scenarios";
import { findNftBySlug } from "./nfts";

/** Taxa de rede fixa do seed, em ETH. */
export const NETWORK_FEE_ETH = "0.02";
/** Taxa depois da mudança do cenário `price-changed`. */
export const CHANGED_NETWORK_FEE_ETH = "0.03";

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

export type QuoteItem = { slug: string; quantity: number };

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

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; status: 422; code: "coupon_invalid" | "coupon_expired"; message: string };

/**
 * Cotação do mock. O preço vem do catálogo, não do cliente. `revision` é a versão que a tela
 * já mostra: no cenário `price-changed`, quem já viu uma versão recebe a versão 2 com taxa
 * maior; sem `revision` (carrinho) a cotação é a versão 1, ou a maior versão de preço dos itens
 * depois de um `nft.updated`.
 */
export function quoteFor(items: QuoteItem[], couponCode: string, revision?: number): QuoteResult {
  const subtotalEth = items.reduce((sum, item) => {
    const nft = findNftBySlug(item.slug);
    return nft ? addEth(sum, mulEth(nft.priceEth, item.quantity)) : sum;
  }, "0");

  let rate = "0";
  const code = couponCode.trim();
  if (code !== "") {
    const coupon = applyCoupon(code);
    if (!coupon.ok) {
      const expired = coupon.reason === "expired";
      return {
        ok: false,
        status: 422,
        code: expired ? "coupon_expired" : "coupon_invalid",
        message: expired ? "Este cupom expirou." : "Cupom inválido.",
      };
    }
    rate = coupon.rate;
  }

  const changed = getScenario() === "price-changed" && revision !== undefined && revision >= 1;
  const networkFeeEth = changed ? CHANGED_NETWORK_FEE_ETH : NETWORK_FEE_ETH;
  const discountEth = mulEth(subtotalEth, Number(rate));
  return {
    ok: true,
    quote: {
      subtotalEth,
      discountEth,
      networkFeeEth,
      totalEth: addEth(subEth(subtotalEth, discountEth), networkFeeEth),
      // Um `nft.updated` sobe a versão do item, e a cotação acompanha: a confirmação antiga não passa.
      version: Math.max(changed ? 2 : 1, maxNftVersion(items.map((item) => item.slug))),
    },
  };
}

/**
 * `POST /api/quote`: visitante e usuário logado recebem cotação. Cupom inválido ou expirado
 * responde 422 e não aplica desconto.
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

    const couponCode = typeof body.couponCode === "string" ? body.couponCode : "";
    const revision = typeof body.revision === "number" ? body.revision : undefined;
    const result = quoteFor(readItems(body.items), couponCode, revision);
    if (!result.ok) {
      return errorResponse(result.status, result.code, result.message, { couponCode: result.message });
    }
    return HttpResponse.json(result.quote);
  }),
];
