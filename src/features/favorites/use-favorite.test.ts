import { describe, expect, it } from "vitest";
import { toggleFavoriteList } from "./use-favorite";

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
