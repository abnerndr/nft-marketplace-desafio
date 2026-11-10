import { afterEach, describe, expect, it, vi } from "vitest";
import { reclaimMockClient } from "./reclaim";

type MessageListener = (event: MessageEvent) => void;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function installServiceWorker(controller: { postMessage: (message: string) => void } | null) {
  const listeners = new Set<MessageListener>();
  vi.stubGlobal("navigator", {
    serviceWorker: {
      controller,
      addEventListener: (_type: string, listener: MessageListener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: MessageListener) => {
        listeners.delete(listener);
      },
    },
  });
  return {
    listeners,
    enable() {
      for (const listener of listeners) {
        listener({ data: { type: "MOCKING_ENABLED" } } as MessageEvent);
      }
    },
  };
}

describe("reclaimMockClient", () => {
  it("reenvia MOCK_ACTIVATE e só segue depois que o worker confirma o cliente", async () => {
    const postMessage = vi.fn();
    const worker = installServiceWorker({ postMessage });

    let settled = false;
    const pending = reclaimMockClient().then(() => {
      settled = true;
    });

    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith("MOCK_ACTIVATE"));
    expect(settled).toBe(false);

    worker.enable();
    await pending;
    expect(settled).toBe(true);
  });

  it("não bloqueia a request quando não há service worker controlando a página", async () => {
    const worker = installServiceWorker(null);
    await reclaimMockClient();
    expect(worker.listeners.size).toBe(0);
  });

  it("não espera para sempre se o worker morto não responder", async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    installServiceWorker({ postMessage });

    const pending = reclaimMockClient();
    await vi.advanceTimersByTimeAsync(1_000);
    await pending;
    expect(postMessage).toHaveBeenCalledWith("MOCK_ACTIVATE");
  });
});
