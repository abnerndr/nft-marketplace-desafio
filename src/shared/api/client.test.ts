import { describe, expect, it } from "vitest";
import { captureSessionIdentity, setSessionIdentity } from "@/features/auth/session-identity";
import { isSessionExpiry, requestMatchesCurrentSession } from "./client";

describe("isSessionExpiry", () => {
  it("401 com token em pedido e checkout é sessão vencida", () => {
    expect(isSessionExpiry(401, "/orders", true)).toBe(true);
    expect(isSessionExpiry(401, "/cart", true)).toBe(true);
    expect(isSessionExpiry(401, "/auth/session", true)).toBe(true);
  });

  it("login, cadastro e logout com 401 não são sessão vencida", () => {
    expect(isSessionExpiry(401, "/auth/login", true)).toBe(false);
    expect(isSessionExpiry(401, "/auth/register", true)).toBe(false);
    expect(isSessionExpiry(401, "/auth/logout", true)).toBe(false);
  });

  it("sem token ou com outro status não dispara o handler", () => {
    expect(isSessionExpiry(401, "/orders", false)).toBe(false);
    expect(isSessionExpiry(403, "/orders", true)).toBe(false);
    expect(isSessionExpiry(200, "/orders", true)).toBe(false);
  });

  it("401 de outra geração ou outro token não pertence à sessão atual", () => {
    setSessionIdentity("user-marina");
    const marina = { identity: captureSessionIdentity(), token: "token-a" };
    expect(requestMatchesCurrentSession(marina, "token-a")).toBe(true);

    setSessionIdentity("user-rafael");
    expect(requestMatchesCurrentSession(marina, "token-a")).toBe(false);
    const rafael = { identity: captureSessionIdentity(), token: "token-b" };
    expect(requestMatchesCurrentSession(rafael, "token-b")).toBe(true);
    expect(requestMatchesCurrentSession(rafael, "token-a")).toBe(false);
    expect(requestMatchesCurrentSession(undefined, "token-b")).toBe(false);
  });
});
