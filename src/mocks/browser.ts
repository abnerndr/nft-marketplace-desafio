import { setupWorker } from "msw/browser";
import { initMockState, resetDatabase, setScenario } from "./db";
import { handlers } from "./handlers";
import { isScenarioId, type ScenarioId } from "./scenarios";

export const worker = setupWorker(...handlers);

export type KurioMockControls = {
  reset: () => void;
  setScenario: (id: ScenarioId) => void;
  emit: (type: string, payload?: unknown) => void;
};

declare global {
  interface Window {
    __kurio?: KurioMockControls;
  }
}

export const MOCK_EVENT = "kurio:mock";

export async function enableMocks(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MOCKS === "false") return;

  const envScenario = import.meta.env.VITE_DEFAULT_SCENARIO;
  initMockState(window.location.search, isScenarioId(envScenario) ? envScenario : "default");

  window.__kurio = {
    reset: resetDatabase,
    setScenario: (id) => {
      if (!isScenarioId(id)) throw new Error(`Cenário desconhecido: ${String(id)}`);
      setScenario(id);
    },
    emit: (type, payload) => {
      window.dispatchEvent(new CustomEvent(MOCK_EVENT, { detail: { type, payload } }));
    },
  };

  await worker.start();
}
