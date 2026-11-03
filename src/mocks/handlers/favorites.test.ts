import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, initMockState } from "../db";
import { applyScenario } from "../scenarios";
import { authHandlers } from "./auth";
import { favoriteHandlers } from "./favorites";
import { nftHandlers } from "./nfts";

vi.stubGlobal("location", new URL("http://kurio.test/"));

const server = setupServer(...authHandlers, ...nftHandlers, ...favoriteHandlers);
const base = "http://kurio.test/api";

async function login(): Promise<string> {
  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "marina@kurio.test", password: "Marina#2026" }),
  });
  return (await response.json()).token;
}

function call(method: string, path: string, token?: string) {
  return fetch(`${base}${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

describe("/api/favorites", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(() => initMockState("?reset=1"));
  afterEach(() => applyScenario("default"));
  afterAll(() => server.close());

  it("exige sessão em todas as rotas", async () => {
    for (const [method, path] of [["GET", "/favorites"], ["PUT", "/favorites/emerald-ape-042"], ["DELETE", "/favorites/emerald-ape-042"]]) {
      const response = await call(method, path);
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthorized");
    }
  });

  it("lista o favorito do seed, grava e remove sem duplicar", async () => {
    const token = await login();
    expect((await (await call("GET", "/favorites", token)).json()).favorites).toEqual(["emerald-ape-042"]);

    const added = await call("PUT", "/favorites/sage-nomad-009", token);
    expect(added.status).toBe(200);
    await call("PUT", "/favorites/sage-nomad-009", token);
    expect(getDatabase().favorites["user-marina"]).toEqual(["emerald-ape-042", "sage-nomad-009"]);

    await call("DELETE", "/favorites/emerald-ape-042", token);
    expect(getDatabase().favorites["user-marina"]).toEqual(["sage-nomad-009"]);
  });

  it("devolve 404 para slug inexistente", async () => {
    const response = await call("PUT", "/favorites/nao-existe", await login());
    expect(response.status).toBe(404);
  });
});
