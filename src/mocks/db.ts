import { applyScenario, getScenario, isScenarioId, type ScenarioId } from "./scenarios";
import { createSeed, type Database } from "./seed";

export const STORAGE_KEY = "kurio.mock";

type Persisted = { scenario: ScenarioId; db: Database };

let database: Database | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Ponto de extensão: cenários que precisarem de dados próprios mudam o seed aqui. */
function seedForScenario(): Database {
  return createSeed();
}

function persist(): void {
  if (!database) return;
  const payload: Persisted = { scenario: getScenario(), db: database };
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Sem armazenamento disponível: o estado fica só em memória.
  }
}

function load(): Persisted | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (!parsed.db || !isScenarioId(parsed.scenario)) return null;
    return { scenario: parsed.scenario, db: parsed.db };
  } catch {
    return null;
  }
}

/** Banco em memória, restaurado do localStorage na primeira leitura. */
export function getDatabase(): Database {
  if (!database) {
    const saved = load();
    if (saved) {
      applyScenario(saved.scenario);
      database = saved.db;
    } else {
      database = seedForScenario();
      persist();
    }
  }
  return database;
}

/** Grava o estado atual depois de uma mutação nos handlers. */
export function saveDatabase(): void {
  persist();
}

/** Volta ao seed do cenário atual e regrava o localStorage. */
export function resetDatabase(): void {
  database = seedForScenario();
  applyScenario(getScenario());
  persist();
}

export function setScenario(id: ScenarioId): void {
  applyScenario(id);
  resetDatabase();
}

/**
 * Lê `?reset=1` e `?scenario=` antes do worker responder.
 * `defaultScenario` vale quando nada foi gravado antes.
 */
export function initMockState(search: string, defaultScenario: ScenarioId = "default"): void {
  const params = new URLSearchParams(search);
  const wantedScenario = params.get("scenario");

  if (params.get("reset") === "1") {
    try {
      storage()?.removeItem(STORAGE_KEY);
    } catch {
      // ignora
    }
    database = null;
    applyScenario(isScenarioId(wantedScenario) ? wantedScenario : defaultScenario);
    resetDatabase();
    return;
  }

  const saved = load();
  applyScenario(saved ? saved.scenario : defaultScenario);
  database = saved ? saved.db : null;
  if (isScenarioId(wantedScenario)) {
    setScenario(wantedScenario);
  } else {
    getDatabase();
  }
}
