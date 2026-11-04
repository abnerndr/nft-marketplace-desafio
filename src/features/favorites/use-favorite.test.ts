import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { captureSessionIdentity, setSessionIdentity } from "@/features/auth/session-identity";
import { favoritesKey, prepareFavoriteToggle, toggleFavoriteList } from "./use-favorite";

describe("toggleFavoriteList", () => {
  it("adiciona o slug ausente ao fim da lista", () => {
    expect(toggleFavoriteList(["emerald-ape-042"], "sage-nomad-009")).toEqual(["emerald-ape-042", "sage-nomad-009"]);
  });

  it("remove o slug presente e mantém a ordem dos demais", () => {
    expect(toggleFavoriteList(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("não altera a lista de entrada", () => {
    const original = ["a"];
    toggleFavoriteList(original, "b");
    toggleFavoriteList(original, "a");
    expect(original).toEqual(["a"]);
  });

  it("alterna de volta ao estado inicial", () => {
    const once = toggleFavoriteList([], "a");
    expect(once).toEqual(["a"]);
    expect(toggleFavoriteList(once, "a")).toEqual([]);
  });
});

describe("prepareFavoriteToggle", () => {
  it("não recria o cache da conta anterior se a sessão muda durante o cancelamento", async () => {
    const client = new QueryClient();
    setSessionIdentity("user-marina");
    const identity = captureSessionIdentity();
    const key = favoritesKey("user-marina");
    client.setQueryData(key, ["emerald-ape-042"]);
    vi.spyOn(client, "cancelQueries").mockImplementation(async () => {
      client.removeQueries({ queryKey: ["private"] });
      setSessionIdentity(null);
    });

    await prepareFavoriteToggle(client, "sage-nomad-009", identity);

    expect(client.getQueryData(key)).toBeUndefined();
  });
});
