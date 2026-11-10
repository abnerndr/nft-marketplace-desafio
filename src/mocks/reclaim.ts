const RECLAIM_TIMEOUT_MS = 1_000;

type ActivationListener = (event: MessageEvent) => void;

let inflight: Promise<void> | null = null;

function readController(): ServiceWorker | null {
  const nav = globalThis.navigator;
  if (!nav || !("serviceWorker" in nav)) return null;
  return nav.serviceWorker.controller;
}

/**
 * O service worker do MSW esquece os clientes quando o navegador o mata por inatividade.
 * Com a lista vazia ele deixa a request passar, o Vite devolve o HTML da página e o
 * catálogo quebra no parse ("expected object, received string"). `MOCK_ACTIVATE`
 * recoloca este documento na lista antes da próxima chamada.
 */
export function reclaimMockClient(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MOCKS === "false") return Promise.resolve();
  const controller = readController();
  if (!controller) return Promise.resolve();
  if (!inflight) {
    inflight = activate(controller).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

function activate(controller: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(finish, RECLAIM_TIMEOUT_MS);

    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      resolve();
    }

    const onMessage: ActivationListener = (event) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === "MOCKING_ENABLED") finish();
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    try {
      controller.postMessage("MOCK_ACTIVATE");
    } catch {
      finish();
    }
  });
}

/** Corpo em texto: a request não foi mockada e caiu no HTML do Vite. */
export function isSpaFallbackBody(data: unknown): data is string {
  return typeof data === "string";
}
