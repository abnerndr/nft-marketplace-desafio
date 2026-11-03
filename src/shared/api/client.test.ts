import { describe, expect, it } from "vitest";
import { isSessionExpiry } from "./client";

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
});
