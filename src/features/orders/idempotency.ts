/** Serializa com chaves em ordem, para que `{a,b}` e `{b,a}` virem o mesmo texto. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalize(body: string): string {
  try {
    return canonical(JSON.parse(body));
  } catch {
    return body;
  }
}

/**
 * Diz se `nextBody` é a mesma tentativa de pedido que `storedBody`. A mesma tentativa
 * reaproveita a chave de idempotência (retry depois de timeout); um corpo diferente
 * é outra tentativa e precisa de chave nova. Não considera a ordem das chaves do JSON.
 */
export function sameOrderAttempt(storedBody: string, nextBody: string): boolean {
  return normalize(storedBody) === normalize(nextBody);
}

/** Uma chave por tentativa de pedido. A UI guarda e reenvia a mesma no retry. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Prefixo; a chave completa inclui o userId para isolar contas no mesmo browser. */
export const ORDER_ATTEMPT_KEY_PREFIX = "kurio.order-attempt.";
/** @deprecated chave legada sem dono — limpa no logout. */
export const ORDER_ATTEMPT_KEY = "kurio.order-attempt";

export type OrderAttempt = {
  userId: string;
  key: string;
  body: string;
  orderId?: string;
  state: "unknown" | "pending";
};

export const ORDER_OUTCOME_UNKNOWN = "order_outcome_unknown";

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function storageKey(userId: string): string {
  return `${ORDER_ATTEMPT_KEY_PREFIX}${userId}`;
}

function parseAttempt(raw: string, expectedUserId?: string): OrderAttempt | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { userId, key, body, orderId, state } = parsed as Record<string, unknown>;
    if (typeof key !== "string" || key === "" || typeof body !== "string") return null;
    if (typeof userId !== "string" || userId === "") return null;
    if (expectedUserId && userId !== expectedUserId) return null;
    if (state !== "unknown" && state !== "pending") return null;
    return {
      userId,
      key,
      body,
      state,
      ...(typeof orderId === "string" ? { orderId } : {}),
    };
  } catch {
    return null;
  }
}

/** Tentativa em voo do usuário: sobrevive a reload de `/checkout`. `null` se não há nada. */
export function readOrderAttempt(userId?: string | null): OrderAttempt | null {
  const store = sessionStore();
  if (!store) return null;
  if (userId) {
    const raw = store.getItem(storageKey(userId));
    return raw ? parseAttempt(raw, userId) : null;
  }
  // Sem userId: só a chave legada (migração).
  const legacy = store.getItem(ORDER_ATTEMPT_KEY);
  return legacy ? parseAttempt(legacy) : null;
}

export function writeOrderAttempt(attempt: OrderAttempt): void {
  try {
    sessionStore()?.setItem(storageKey(attempt.userId), JSON.stringify(attempt));
    sessionStore()?.removeItem(ORDER_ATTEMPT_KEY);
  } catch {
    // Sem sessionStorage: a tentativa só vive na memória da página.
  }
}

export function clearOrderAttempt(userId?: string | null): void {
  try {
    const store = sessionStore();
    if (!store) return;
    if (userId) store.removeItem(storageKey(userId));
    else {
      for (const key of Object.keys(store)) {
        if (key === ORDER_ATTEMPT_KEY || key.startsWith(ORDER_ATTEMPT_KEY_PREFIX)) {
          store.removeItem(key);
        }
      }
    }
  } catch {
    // ignora
  }
}

/**
 * Reusa a chave se o corpo é o da tentativa guardada.
 * Enquanto o resultado for desconhecido (ou pendente), um corpo diferente NÃO substitui —
 * lança `order_outcome_unknown` para forçar recuperação da tentativa original.
 */
export function resolveOrderAttempt(userId: string, body: string): OrderAttempt {
  const stored = readOrderAttempt(userId);
  if (stored) {
    if (sameOrderAttempt(stored.body, body)) return stored;
    throw new Error(ORDER_OUTCOME_UNKNOWN);
  }
  const next: OrderAttempt = { userId, key: newIdempotencyKey(), body, state: "unknown" };
  writeOrderAttempt(next);
  return next;
}

export function markOrderAttemptPending(attempt: OrderAttempt, orderId: string): OrderAttempt {
  const next: OrderAttempt = { ...attempt, orderId, state: "pending" };
  writeOrderAttempt(next);
  return next;
}
