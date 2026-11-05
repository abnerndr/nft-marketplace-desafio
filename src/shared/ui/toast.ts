import { useSyncExternalStore } from "react";

export type AppToast = {
  id: string;
  message: string;
};

const MAX_TOASTS = 3;
const DEFAULT_DURATION_MS = 3200;

let toasts: readonly AppToast[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(next: readonly AppToast[]) {
  toasts = next;
  for (const listener of listeners) listener();
}

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

/** Mostra um aviso curto no estilo Kurio; some sozinho após alguns segundos. */
export function pushToast(message: string, durationMs = DEFAULT_DURATION_MS): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  emit([...toasts, { id, message }].slice(-MAX_TOASTS));
  clearTimer(id);
  timers.set(
    id,
    setTimeout(() => {
      dismissToast(id);
    }, durationMs),
  );
  return id;
}

export function dismissToast(id: string): void {
  clearTimer(id);
  if (!toasts.some((toast) => toast.id === id)) return;
  emit(toasts.filter((toast) => toast.id !== id));
}

export function clearToasts(): void {
  for (const id of timers.keys()) clearTimer(id);
  if (toasts.length > 0) emit([]);
}

export function getToasts(): readonly AppToast[] {
  return toasts;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToasts(): readonly AppToast[] {
  return useSyncExternalStore(subscribe, () => toasts, () => toasts);
}
