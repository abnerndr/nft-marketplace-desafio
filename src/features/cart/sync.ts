import { isAxiosError } from "axios";
import { api } from "@/shared/api/client";
import { cartViewSchema, nftDetailSchema } from "@/shared/domain/contracts";
import { readGuestCoupon, restoreGuestItems, setGuestCoupon, takeGuestItems } from "./guest-cart";
import { mergeGuestCart, type MergeItem } from "./merge";

async function availabilityOf(slug: string): Promise<Map<string, number> | null> {
  try {
    const { data } = await api.get(`/nfts/${encodeURIComponent(slug)}`);
    return new Map(nftDetailSchema.parse(data).editions.map((edition) => [edition.id, edition.available]));
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

/**
 * Chamada uma vez no login/cadastro bem-sucedido: leva o carrinho de visitante
 * (`kurio.guest-cart`) para a API e apaga a chave. A chave é apagada antes de qualquer
 * request, então dois logins seguidos nunca enviam os mesmos itens duas vezes.
 */
export async function syncGuestCart(): Promise<void> {
  const guest = takeGuestItems();
  if (guest.length === 0) return;

  let sent = 0;
  try {
    const { data } = await api.get("/cart");
    const userLines = cartViewSchema.parse(data).items;

    const stock = new Map<string, Map<string, number> | null>();
    for (const slug of new Set(guest.map((item) => item.slug))) {
      stock.set(slug, await availabilityOf(slug));
    }

    const guestItems: MergeItem[] = guest.flatMap((item) => {
      const available = stock.get(item.slug)?.get(item.editionId);
      return available === undefined ? [] : [{ ...item, available }];
    });
    const userItems: MergeItem[] = userLines.map(({ slug, editionId, quantity, available }) => ({
      slug,
      editionId,
      quantity,
      available,
    }));
    const have = new Map(userItems.map((item) => [`${item.slug}~${item.editionId}`, item.quantity]));

    for (const item of mergeGuestCart(guestItems, userItems)) {
      const missing = item.quantity - (have.get(`${item.slug}~${item.editionId}`) ?? 0);
      if (missing < 1 || !item.slug) continue;
      try {
        await api.post("/cart/items", { slug: item.slug, editionId: item.editionId, quantity: missing });
        sent += 1;
      } catch (error) {
        // Estoque mudou no meio do caminho: essa linha fica de fora, as outras seguem.
        if (isAxiosError(error) && error.response?.status === 409) continue;
        throw error;
      }
    }
  } catch (error) {
    // Falha antes de qualquer envio: devolve os itens para tentar de novo no próximo login.
    if (sent === 0) restoreGuestItems(guest);
    throw error;
  }
}

/**
 * Chamada no login/cadastro: leva o cupom de visitante (`kurio.guest-coupon`) para o carrinho do
 * usuário, só se ele ainda não tiver cupom. A chave do visitante sempre é apagada, inclusive quando
 * o usuário já tinha cupom ou o servidor recusou o código (422). Falha de rede mantém a chave.
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
