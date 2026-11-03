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
