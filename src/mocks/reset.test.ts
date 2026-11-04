import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, initMockState, resetDatabase } from "./db";
import { KURIO_PREFIX } from "./reset";
import { getScenario } from "./scenarios";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, String(value)),
  };
}

describe("reset integral", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    vi.stubGlobal("location", new URL("http://kurio.test/"));
    initMockState("?reset=1");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("apaga chaves kurio.* e volta ao seed conhecido", () => {
    localStorage.setItem("kurio.guest-cart", "[]");
    localStorage.setItem("other", "keep");
    sessionStorage.setItem("kurio.order-attempt.user-marina", "{}");
    sessionStorage.setItem("kurio.merge-attempt.user-marina", "{}");
    getDatabase().carts["user-marina"].items.push({ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1 });

    resetDatabase();

    expect(localStorage.getItem("kurio.guest-cart")).toBeNull();
    expect(sessionStorage.getItem("kurio.order-attempt.user-marina")).toBeNull();
    expect(sessionStorage.getItem("kurio.merge-attempt.user-marina")).toBeNull();
    expect(localStorage.getItem("other")).toBe("keep");
    expect(getDatabase().carts["user-marina"].items).toEqual([]);
    expect(getDatabase().nfts).toHaveLength(36);
    expect(getScenario()).toBe("default");
    expect(Object.keys(localStorage).some((key) => key.startsWith(KURIO_PREFIX) && key !== "kurio.mock")).toBe(false);
  });
});
