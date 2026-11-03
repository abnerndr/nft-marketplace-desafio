import { useSyncExternalStore } from "react";
import { z } from "zod";
import { cartItemSchema } from "@/shared/domain/contracts";

export const GUEST_CART_KEY = "kurio.guest-cart";
/** Cupom do visitante, guardado ao lado dos itens para sobreviver a um refresh. */
export const GUEST_COUPON_KEY = "kurio.guest-coupon";

export type GuestItem = z.infer<typeof cartItemSchema>;

const guestItemsSchema = z.array(cartItemSchema);

/** Erro de regra do carrinho de visitante; a mensagem vai direto para a tela. */
export class GuestCartError extends Error {}

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Texto cru da chave; serve de snapshot estável para `useSyncExternalStore`. */
function readRaw(): string {
  try {
    return storage()?.getItem(GUEST_CART_KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseGuestItems(raw: string): GuestItem[] {
  if (!raw) return [];
  try {
    const parsed = guestItemsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function readGuestItems(): GuestItem[] {
  return parseGuestItems(readRaw());
}

function writeGuestItems(items: GuestItem[]): void {
  try {
    if (items.length === 0) storage()?.removeItem(GUEST_CART_KEY);
    else storage()?.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // Sem armazenamento disponível: o carrinho de visitante não persiste.
  }
  notify();
}

function readCouponRaw(): string {
  try {
    return storage()?.getItem(GUEST_COUPON_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setGuestCoupon(code: string | null): void {
  try {
    if (code) storage()?.setItem(GUEST_COUPON_KEY, code);
    else storage()?.removeItem(GUEST_COUPON_KEY);
  } catch {
    // Sem armazenamento disponível: o cupom de visitante não persiste.
  }
  notify();
}

export function restoreGuestItems(items: GuestItem[]): void {
  writeGuestItems(items);
}

/** Lê e apaga a chave de uma vez: quem chama passa a ser o único dono dos itens. */
export function takeGuestItems(): GuestItem[] {
  const items = readGuestItems();
  writeGuestItems([]);
  return items;
}

function same(item: GuestItem, slug: string, editionId: string): boolean {
  return item.slug === slug && item.editionId === editionId;
}

function stockError(available: number): GuestCartError {
  return new GuestCartError(`Só há ${available} unidade(s) disponível(is).`);
}

export function addGuestItem(input: GuestItem & { available?: number }): GuestItem {
  const items = readGuestItems();
  const existing = items.find((item) => same(item, input.slug, input.editionId));
  const total = (existing?.quantity ?? 0) + input.quantity;
  if (input.available !== undefined && total > input.available) throw stockError(input.available);

  const next = existing
    ? items.map((item) => (item === existing ? { ...item, quantity: total } : item))
    : [...items, { slug: input.slug, editionId: input.editionId, quantity: input.quantity }];
  writeGuestItems(next);
  return { slug: input.slug, editionId: input.editionId, quantity: total };
}

export function setGuestQuantity(slug: string, editionId: string, quantity: number, available: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new GuestCartError("Informe uma quantidade inteira a partir de 1.");
  }
  if (quantity > available) throw stockError(available);
  writeGuestItems(readGuestItems().map((item) => (same(item, slug, editionId) ? { ...item, quantity } : item)));
}

export function removeGuestItem(slug: string, editionId: string): void {
  writeGuestItems(readGuestItems().filter((item) => !same(item, slug, editionId)));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === GUEST_CART_KEY || event.key === GUEST_COUPON_KEY || event.key === null) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Texto cru do carrinho de visitante, reativo a mudanças locais e de outras abas. */
export function useGuestCartRaw(): string {
  return useSyncExternalStore(subscribe, readRaw, () => "");
}

/** Cupom aplicado do visitante (`null` quando não há), reativo a mudanças locais e de outras abas. */
export function useGuestCoupon(): string | null {
  const raw = useSyncExternalStore(subscribe, readCouponRaw, () => "");
  return raw === "" ? null : raw;
}
