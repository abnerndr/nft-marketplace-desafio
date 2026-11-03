import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/shared/api/client";
import { clearSessionToken, readSessionToken, SESSION_STORAGE_KEY, writeSessionToken } from "./session";

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

function authorizationFor(): unknown {
  let seen: unknown = "não chamou";
  return api
    .get("/qualquer", {
      adapter: async (config) => {
        seen = config.headers.Authorization;
        return { data: {}, status: 200, statusText: "OK", headers: {}, config };
      },
    })
    .then(() => seen);
}

describe("token da sessão", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sem token, readSessionToken devolve null e o GET não envia Authorization", async () => {
    expect(readSessionToken()).toBeNull();
    expect(await authorizationFor()).toBeUndefined();
  });

  it("com token abc, devolve abc e o cliente envia Bearer abc", async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "abc");
    expect(readSessionToken()).toBe("abc");
    expect(await authorizationFor()).toBe("Bearer abc");
  });

  it("writeSessionToken grava só o token opaco, sem JSON", () => {
    writeSessionToken("xyz");
    expect(localStorage.getItem("kurio.session")).toBe("xyz");
  });

  it("logout remove a chave", () => {
    writeSessionToken("abc");
    clearSessionToken();
    expect(localStorage.getItem("kurio.session")).toBeNull();
    expect(readSessionToken()).toBeNull();
  });
});
