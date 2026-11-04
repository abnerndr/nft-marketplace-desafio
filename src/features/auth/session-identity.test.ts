import { describe, expect, it } from "vitest";
import { captureSessionIdentity, isCurrentSession, privateQueryKey, setSessionIdentity } from "./session-identity";

describe("identidade da sessão", () => {
  it("identidade capturada fica obsoleta quando a conta muda", () => {
    setSessionIdentity("user-marina");
    const captured = captureSessionIdentity();

    expect(captured.userId).toBe("user-marina");
    expect(isCurrentSession(captured)).toBe(true);

    setSessionIdentity("user-rafael");

    expect(isCurrentSession(captured)).toBe(false);
    expect(captureSessionIdentity()).toEqual({ userId: "user-rafael", generation: captured.generation + 1 });
    expect(isCurrentSession(captureSessionIdentity())).toBe(true);
  });

  it("logout e expiração avançam a geração mesmo sem usuário", () => {
    setSessionIdentity("user-marina");
    const loggedIn = captureSessionIdentity();

    setSessionIdentity(null);

    expect(isCurrentSession(loggedIn)).toBe(false);
    expect(captureSessionIdentity()).toEqual({ userId: null, generation: loggedIn.generation + 1 });
  });

  it("privateQueryKey isola os dados pelo usuário", () => {
    expect(privateQueryKey("user-marina", "profile")).toEqual(["private", "user-marina", "profile"]);
    expect(privateQueryKey("user-rafael", "cart", "server")).toEqual(["private", "user-rafael", "cart", "server"]);
  });
});
