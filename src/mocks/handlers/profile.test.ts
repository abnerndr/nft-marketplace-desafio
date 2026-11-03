import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, initMockState } from "../db";
import { applyScenario } from "../scenarios";
import { authHandlers, sha256Hex } from "./auth";
import { profileHandlers } from "./profile";
import { walletHandlers } from "./wallets";

vi.stubGlobal("location", new URL("http://kurio.test/"));

const server = setupServer(...authHandlers, ...walletHandlers, ...profileHandlers);
const base = "http://kurio.test/api";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

let token = "";

function call(path: string, method: string, body?: unknown, auth = true) {
  return fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function login(email: string, password: string) {
  const response = await call("/auth/login", "POST", { email, password }, false);
  return response;
}

describe("handlers de perfil", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(async () => {
    initMockState("?reset=1");
    token = (await (await login("marina@kurio.test", "Marina#2026")).json()).token;
  });
  afterEach(() => applyScenario("default"));
  afterAll(() => server.close());

  it("exige sessão em todas as rotas", async () => {
    for (const [path, method] of [
      ["/profile", "GET"],
      ["/profile", "PATCH"],
      ["/profile/password", "POST"],
      ["/profile/avatar", "POST"],
    ] as const) {
      const response = await call(path, method, method === "GET" ? undefined : {}, false);
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthorized");
    }
  });

  it("GET devolve o perfil sem senha", async () => {
    const response = await call("/profile", "GET");
    expect(response.status).toBe(200);
    const { profile } = await response.json();
    expect(profile).toMatchObject({ name: "Marina Alves", email: "marina@kurio.test", username: "marina", avatarUrl: null });
    expect(JSON.stringify(profile)).not.toContain("passwordHash");
  });

  it("PATCH grava nome e e-mail e persistem na sessão", async () => {
    const response = await call("/profile", "PATCH", { name: "Marina A.", email: "Marina.Nova@Kurio.test", ens: "marina" });
    expect(response.status).toBe(200);
    expect((await response.json()).profile).toMatchObject({ name: "Marina A.", email: "marina.nova@kurio.test", ens: "marina" });

    const session = await (await call("/auth/session", "GET")).json();
    expect(session.user.name).toBe("Marina A.");
    expect((await (await call("/profile", "GET")).json()).profile.name).toBe("Marina A.");
  });

  it("PATCH inválido: 422 validation com fields", async () => {
    const response = await call("/profile", "PATCH", { name: " ", email: "rafael@kurio.test", username: "a" });
    expect(response.status).toBe(422);
    const { error } = await response.json();
    expect(error.code).toBe("validation");
    expect(Object.keys(error.fields).sort()).toEqual(["email", "name", "username"]);
    expect((await (await call("/profile", "GET")).json()).profile.name).toBe("Marina Alves");
  });

  it("senha atual errada: 422 validation e a senha não muda", async () => {
    const response = await call("/profile/password", "POST", {
      currentPassword: "errada#123",
      newPassword: "Nova#Senha2026",
      confirmPassword: "Nova#Senha2026",
    });
    expect(response.status).toBe(422);
    const { error } = await response.json();
    expect(error.code).toBe("validation");
    expect(error.fields.currentPassword).toBeDefined();
    expect((await login("marina@kurio.test", "Marina#2026")).status).toBe(200);
  });

  it("troca a senha guardando só o SHA-256", async () => {
    const response = await call("/profile/password", "POST", {
      currentPassword: "Marina#2026",
      newPassword: "Nova#Senha2026",
      confirmPassword: "Nova#Senha2026",
    });
    expect(response.status).toBe(204);

    const user = getDatabase().users.find((candidate) => candidate.id === "user-marina");
    expect(user?.passwordHash).toBe(await sha256Hex("Nova#Senha2026"));
    expect(JSON.stringify(getDatabase())).not.toContain("Nova#Senha2026");
    expect((await login("marina@kurio.test", "Marina#2026")).status).toBe(401);
    expect((await login("marina@kurio.test", "Nova#Senha2026")).status).toBe(200);
  });

  it("senha nova curta ou confirmação diferente: 422", async () => {
    const response = await call("/profile/password", "POST", {
      currentPassword: "Marina#2026",
      newPassword: "curta",
      confirmPassword: "outra",
    });
    expect(response.status).toBe(422);
    const { error } = await response.json();
    expect(Object.keys(error.fields).sort()).toEqual(["confirmPassword", "newPassword"]);
  });

  it("avatar fica gravado e some com null", async () => {
    const saved = await call("/profile/avatar", "POST", { dataUrl: PNG });
    expect(saved.status).toBe(200);
    expect((await saved.json()).profile.avatarUrl).toBe(PNG);
    expect((await (await call("/profile", "GET")).json()).profile.avatarUrl).toBe(PNG);

    const removed = await call("/profile/avatar", "POST", { dataUrl: null });
    expect((await removed.json()).profile.avatarUrl).toBeNull();
  });

  it("avatar que não é imagem ou é grande demais: 422", async () => {
    const notImage = await call("/profile/avatar", "POST", { dataUrl: "data:text/html;base64,PGI+" });
    expect(notImage.status).toBe(422);
    expect((await notImage.json()).error.fields.avatar).toBeDefined();

    const big = `data:image/png;base64,${"A".repeat(300 * 1024)}`;
    const tooBig = await call("/profile/avatar", "POST", { dataUrl: big });
    expect(tooBig.status).toBe(422);
  });

  it("carteiras gravam os campos extras do formulário", async () => {
    const response = await call("/wallets", "POST", {
      label: "Cofre",
      address: "0x1111111111111111111111111111111111111111",
      network: "ethereum",
      provider: "coinbase",
      alias: "cofre-frio",
      ens: "cofre",
      email: "cofre@kurio.test",
      secondaryAddress: "marina.eth",
      referralCode: "KURIO-10",
    });
    expect(response.status).toBe(201);
    expect((await response.json()).wallet).toMatchObject({
      alias: "cofre-frio",
      ens: "cofre",
      email: "cofre@kurio.test",
      secondaryAddress: "marina.eth",
      referralCode: "KURIO-10",
    });

    const invalid = await call("/wallets", "POST", {
      label: "Cofre 2",
      address: "0x2222222222222222222222222222222222222222",
      network: "ethereum",
      email: "nao-e-email",
      secondaryAddress: "xyz",
    });
    expect(invalid.status).toBe(422);
    expect(Object.keys((await invalid.json()).error.fields).sort()).toEqual(["email", "secondaryAddress"]);
  });
});
