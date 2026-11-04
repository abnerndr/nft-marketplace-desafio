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
  "forbidden",
  "stock-changed",
  "socket-disconnect",
  "price-changed",
  "edition-sold-out",
  "order-timeout",
  "payment-confirmed",
  "payment-declined",
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export const SLOW_NETWORK_DELAY_MS = 1200;
export const TRANSIENT_FAILURES = 2;
/**
 * Espera da primeira `POST /api/orders` no cenário `order-timeout`, antes do erro de rede.
 * Curto de propósito: o `delay` do MSW roda no Service Worker, fora do `page.clock` do Playwright.
 */
export const ORDER_TIMEOUT_DELAY_MS = 250;
/** Esperas das buscas no cenário `out-of-order`: cada uma é mais curta que a anterior. */
export const OUT_OF_ORDER_DELAYS_MS = [900, 400, 50] as const;

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && (SCENARIO_IDS as readonly string[]).includes(value);
}

let currentScenario: ScenarioId = "default";
const transientReads = { list: 0, detail: 0 };
let outOfOrderCalls = 0;

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
  outOfOrderCalls = 0;
}

/**
 * Espera da próxima busca de `/api/nfts` no cenário `out-of-order` (900, 400, 50 ms e
 * depois 50 ms). Tem estado: cada chamada avança o contador. Fora do cenário devolve 0
 * e não conta. O contador volta a zero em `applyScenario`.
 */
export function nextOutOfOrderDelay(): number {
  if (currentScenario !== "out-of-order") return 0;
  const index = Math.min(outOfOrderCalls, OUT_OF_ORDER_DELAYS_MS.length - 1);
  outOfOrderCalls += 1;
  return OUT_OF_ORDER_DELAYS_MS[index];
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
