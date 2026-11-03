import { useSyncExternalStore } from "react";

export type PriceNotice = {
  eventId: string;
  slug: string;
  title: string;
  fromEth: string;
  toEth: string;
};

const MAX_NOTICES = 3;

let notices: readonly PriceNotice[] = [];
const listeners = new Set<() => void>();

function emit(next: readonly PriceNotice[]) {
  notices = next;
  for (const listener of listeners) listener();
}

/** Guarda o aviso de mudança de preço; o mesmo item não acumula avisos antigos. */
export function pushPriceNotice(notice: PriceNotice): void {
  const rest = notices.filter((existing) => existing.slug !== notice.slug);
  emit([...rest, notice].slice(-MAX_NOTICES));
}

export function dismissPriceNotice(eventId: string): void {
  emit(notices.filter((notice) => notice.eventId !== eventId));
}

export function clearPriceNotices(): void {
  if (notices.length > 0) emit([]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePriceNotices(): readonly PriceNotice[] {
  return useSyncExternalStore(subscribe, () => notices, () => notices);
}
