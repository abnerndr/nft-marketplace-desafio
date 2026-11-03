import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, initMockState } from "../db";
import { applyScenario } from "../scenarios";
import { authHandlers, sha256Hex } from "./auth";

vi.stubGlobal("location", new URL("http://kurio.test/"));

const server = setupServer(...authHandlers);
const base = "http://kurio.test/api/auth";

function post(path: string, body: unknown, token?: string) {
  return fetch(`${base}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

function session(token?: string) {
  return fetch(`${base}/session`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

describe("handlers de autenticação", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(() => initMockState("?reset=1"));
  afterEach(() => applyScenario("default"));
  afterAll(() => server.close());

  it("login válido devolve usuário público e token opaco", async () => {
    const response = await post("login", { email: "marina@kurio.test", password: "Marina#2026" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toEqual({ id: "user-marina", name: "Marina Alves", email: "marina@kurio.test" });
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(body)).not.toContain("passwordHash");

    const current = await session(body.token);
    expect(current.status).toBe(200);
    expect((await current.json()).user.email).toBe("marina@kurio.test");
  });

  it("senha errada ou e-mail desconhecido: 401 unauthorized", async () => {
    for (const body of [
      { email: "marina@kurio.test", password: "errada#123" },
      { email: "ninguem@kurio.test", password: "Marina#2026" },
    ]) {
      const response = await post("login", body);
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthorized");
    }
  });

  it("login com campo vazio: 422 validation com fields", async () => {
    const response = await post("login", { email: "", password: "" });
    expect(response.status).toBe(422);
    const { error } = await response.json();
    expect(error.code).toBe("validation");
    expect(Object.keys(error.fields)).toEqual(["email", "password"]);
  });

  it("cadastro com senha curta: 422 em password", async () => {
    const response = await post("register", { name: "Ana", email: "ana@kurio.test", password: "curta" });
    expect(response.status).toBe(422);
    expect(Object.keys((await response.json()).error.fields)).toEqual(["password"]);
  });

  it("e-mail repetido no cadastro: 409 conflict, sem diferenciar maiúsculas", async () => {
    const response = await post("register", { name: "Outra", email: "MARINA@kurio.test", password: "Senha#2026" });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("conflict");
  });

  it("cadastro cria sessão, guarda só o hash e permite login depois", async () => {
    const created = await post("register", { name: "Ana", email: "ana@kurio.test", password: "Senha#2026" });
    expect(created.status).toBe(201);
    const { token, user } = await created.json();
    expect((await session(token)).status).toBe(200);

    const raw = JSON.stringify(getDatabase().users);
    expect(raw).not.toContain("Senha#2026");
    expect(raw).toContain(await sha256Hex("Senha#2026"));
    expect(user.name).toBe("Ana");

    const again = await post("login", { email: "ana@kurio.test", password: "Senha#2026" });
    expect(again.status).toBe(200);
  });

  it("sem token ou com token desconhecido: 401 na sessão", async () => {
    expect((await session()).status).toBe(401);
    expect((await session("inventado")).status).toBe(401);
  });

  it("logout invalida o token", async () => {
    const { token } = await (await post("login", { email: "rafael@kurio.test", password: "Rafael#2026" })).json();
    expect((await post("logout", {}, token)).status).toBe(204);
    expect((await session(token)).status).toBe(401);
  });

  it("cenário session-expired faz a sessão responder 401 mesmo com token válido", async () => {
    const { token } = await (await post("login", { email: "marina@kurio.test", password: "Marina#2026" })).json();
    applyScenario("session-expired");
    expect((await session(token)).status).toBe(401);
  });
});
