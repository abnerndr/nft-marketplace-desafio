import { isAxiosError } from "axios";
import { api } from "@/shared/api/client";
import { cartViewSchema } from "@/shared/domain/contracts";
import { readGuestCoupon, readGuestItems, restoreGuestItems, setGuestCoupon } from "./guest-cart";
import { clearMergeAttempt, newMergeId, readMergeAttempt, writeMergeAttempt, type GuestMergeAttempt } from "./merge-attempt";

export type CartMergeResult = {
  cart: { items: unknown[]; couponCode: string | null };
  adjustments: Array<{ slug: string; editionId: string; from: number; to: number; reason: string }>;
};

/** Última falha de merge após login bem-sucedido — a UI de conta/login consome e limpa. */
let lastMergeFailure: string | null = null;

export function consumeMergeFailure(): string | null {
  const message = lastMergeFailure;
  lastMergeFailure = null;
  return message;
}

export function peekMergeFailure(): string | null {
  return lastMergeFailure;
}

export function reportMergeFailure(message: string): void {
  lastMergeFailure = message;
}

/**
 * Sincroniza o carrinho de visitante via `POST /cart/merge` atômico e idempotente.
 * Persiste a tentativa antes do envio; só limpa guest/tentativa após resposta confirmada.
 */
export async function syncGuestCart(userId: string): Promise<CartMergeResult | null> {
  const existing = readMergeAttempt(userId);
  const guestLines = existing?.lines ?? readGuestItems();
  const couponCode = existing?.couponCode ?? readGuestCoupon();
  if (guestLines.length === 0 && !existing) return null;

  const attempt: GuestMergeAttempt =
    existing ??
    ({
      userId,
      mergeId: newMergeId(),
      lines: guestLines,
      couponCode,
    } satisfies GuestMergeAttempt);

  writeMergeAttempt(attempt);

  try {
    const { data } = await api.post(
      "/cart/merge",
      { lines: attempt.lines, couponCode: attempt.couponCode },
      { headers: { "Idempotency-Key": attempt.mergeId } },
    );
    const result = data as CartMergeResult;
    clearMergeAttempt(userId);
    restoreGuestItems([]);
    setGuestCoupon(null);
    return result;
  } catch (error) {
    const message = isAxiosError(error)
      ? ((error.response?.data as { error?: { message?: string } } | undefined)?.error?.message ??
        "Não foi possível sincronizar o carrinho de visitante.")
      : "Não foi possível sincronizar o carrinho de visitante.";
    reportMergeFailure(message);
    throw error;
  }
}

/**
 * Chamada no login/cadastro: leva o cupom de visitante (`kurio.guest-coupon`) para o carrinho do
 * usuário, só se ele ainda não tiver cupom. Preferimos o merge atômico; este caminho cobre cupom
 * sozinho quando não há linhas.
 */
export async function syncGuestCoupon(): Promise<void> {
  const code = readGuestCoupon();
  if (code === null) return;

  try {
    const { data } = await api.get("/cart");
    if (cartViewSchema.parse(data).couponCode === null) {
      await api.put("/cart/coupon", { couponCode: code });
    }
  } catch (error) {
    if (!(isAxiosError(error) && error.response?.status === 422)) throw error;
  }
  setGuestCoupon(null);
}
