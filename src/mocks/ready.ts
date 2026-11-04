/** Resolvida quando o worker MSW (ou a ausência de mocks) está pronto para atender `/api`. */
let resolveReady: () => void = () => undefined;
let ready = import.meta.env.MODE === "test";

export const mocksReady = ready
  ? Promise.resolve()
  : new Promise<void>((resolve) => {
      resolveReady = () => {
        ready = true;
        resolve();
      };
    });

export function markMocksReady(): void {
  if (!ready) resolveReady();
}

export function waitForMocks(): Promise<void> {
  return mocksReady;
}
