import { delay, http, HttpResponse } from "msw";
import { getScenario, SLOW_NETWORK_DELAY_MS } from "../scenarios";

/**
 * Primeiro handler da lista. `slow-network` atrasa e deixa a requisição seguir
 * para o handler real (retornar `undefined` passa adiante). `offline` falha na rede.
 */
export const scenarioHandlers = [
  http.all("/api/*", async () => {
    const scenario = getScenario();
    if (scenario === "offline") return HttpResponse.error();
    if (scenario === "slow-network") await delay(SLOW_NETWORK_DELAY_MS);
    return undefined;
  }),
];
