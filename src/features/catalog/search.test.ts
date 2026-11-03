import { describe, expect, it } from "vitest";
import {
  catalogSearchSchema,
  cleanSearch,
  parseSearchString,
  stringifySearch,
  withFilter,
} from "./search";

describe("search do catálogo", () => {
  it("faz o parse de coleções repetidas e da página", () => {
    const search = catalogSearchSchema.parse(
      parseSearchString("?collection=music&collection=games&page=3"),
    );
    expect(search.collection).toEqual(["music", "games"]);
    expect(search.page).toBe(3);
  });

  it("aceita uma coleção só como lista e ignora valores inválidos", () => {
    const search = catalogSearchSchema.parse(
      parseSearchString("?collection=music&network=bitcoin&page=0&sort=xyz&tab=nope"),
    );
    expect(search.collection).toEqual(["music"]);
    expect(search.network).toBeUndefined();
    expect(search.page).toBeUndefined();
    expect(search.sort).toBeUndefined();
    expect(search.tab).toBeUndefined();
  });

  it("mudar a coleção no withFilter zera a página para 1", () => {
    const current = catalogSearchSchema.parse(
      parseSearchString("?collection=music&collection=games&page=3"),
    );
    const next = withFilter(current, { collection: ["music"] });
    expect(next.collection).toEqual(["music"]);
    expect(next.page).toBe(1);
  });

  it("serializa listas como parâmetros repetidos e omite o que é padrão", () => {
    const next = cleanSearch(
      withFilter({ collection: ["music", "games"], page: 3 }, { network: ["solana"] }),
    );
    expect(stringifySearch(next)).toBe("?collection=music&collection=games&network=solana");
  });
});
