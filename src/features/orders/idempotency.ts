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

export const ORDER_ATTEMPT_KEY = "kurio.order-attempt";

export type OrderAttempt = { key: string; body: string };

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Tentativa em voo: sobrevive a um reload de `/checkout`. `null` se não há nada guardado. */
export function readOrderAttempt(): OrderAttempt | null {
  try {
    const raw = sessionStore()?.getItem(ORDER_ATTEMPT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { key, body } = parsed as Record<string, unknown>;
    if (typeof key !== "string" || key === "" || typeof body !== "string") return null;
    return { key, body };
  } catch {
    return null;
  }
}

export function writeOrderAttempt(attempt: OrderAttempt): void {
  try {
    sessionStore()?.setItem(ORDER_ATTEMPT_KEY, JSON.stringify(attempt));
  } catch {
    // Sem sessionStorage: a tentativa só vive na memória da página.
  }
}

export function clearOrderAttempt(): void {
  try {
    sessionStore()?.removeItem(ORDER_ATTEMPT_KEY);
  } catch {
    // ignora
  }
}

/**
 * Reusa a chave se o corpo é o da tentativa guardada (retry depois de timeout ou reload).
 * Corpo diferente gera chave nova e substitui o que estava salvo.
 */
export function resolveOrderAttempt(body: string): OrderAttempt {
  const stored = readOrderAttempt();
  if (stored && sameOrderAttempt(stored.body, body)) return stored;
  const next = { key: newIdempotencyKey(), body };
  writeOrderAttempt(next);
  return next;
}
