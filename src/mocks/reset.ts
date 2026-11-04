import { applyScenario, getScenario, type ScenarioId } from "./scenarios";
import { createSeed, type Database } from "./seed";

export const KURIO_PREFIX = "kurio.";

type PersistFn = (db: Database) => void;

function clearKurioKeys(store: Storage | null): void {
  if (!store) return;
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key) keys.push(key);
  }
  for (const key of keys) {
    if (key.startsWith(KURIO_PREFIX)) store.removeItem(key);
  }
}

function storageOf(kind: "local" | "session"): Storage | null {
  try {
    if (kind === "local") return typeof localStorage === "undefined" ? null : localStorage;
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Limpa só chaves `kurio.*` em local/session e recria o seed do cenário. */
export function fullKurioReset(options: {
  setDatabase: (db: Database) => void;
  persist: PersistFn;
  scenario?: ScenarioId;
}): void {
  clearKurioKeys(storageOf("local"));
  clearKurioKeys(storageOf("session"));
  const scenario = options.scenario ?? getScenario();
  applyScenario(scenario);
  const db = createSeed();
  options.setDatabase(db);
  options.persist(db);
}
