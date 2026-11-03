export const SCENARIO_IDS = [
  "default",
  "empty",
  "slow-network",
  "out-of-order",
  "offline",
  "server-error",
  "session-expired",
  "validation-conflict",
  "coupon-invalid",
  "price-changed",
  "edition-sold-out",
  "order-timeout",
  "payment-confirmed",
  "payment-declined",
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export const SLOW_NETWORK_DELAY_MS = 1200;
export const TRANSIENT_FAILURES = 2;

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && (SCENARIO_IDS as readonly string[]).includes(value);
}

let currentScenario: ScenarioId = "default";
const transientReads = { list: 0, detail: 0 };

export function getScenario(): ScenarioId {
  return currentScenario;
}

/** Troca o cenário em memória e zera os contadores de falha transitória. */
export function applyScenario(id: ScenarioId): void {
  currentScenario = id;
  resetTransientCounters();
}

export function resetTransientCounters(): void {
  transientReads.list = 0;
  transientReads.detail = 0;
}

/**
 * Verdadeiro nas duas primeiras leituras de `/api/nfts` e de `/api/nfts/:id`
 * quando o cenário é `server-error`. Tem estado: cada chamada conta uma leitura.
 * A lista e o detalhe têm contadores separados.
 */
export function shouldFailTransient(url: string): boolean {
  if (currentScenario !== "server-error") return false;
  const { pathname } = new URL(url, "http://localhost");
  const path = pathname.replace(/\/+$/, "");
  let key: keyof typeof transientReads;
  if (path === "/api/nfts") key = "list";
  else if (/^\/api\/nfts\/[^/]+$/.test(path)) key = "detail";
  else return false;
  transientReads[key] += 1;
  return transientReads[key] <= TRANSIENT_FAILURES;
}
