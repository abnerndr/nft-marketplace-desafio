import { describe, expect, it } from "vitest";
import { catalogView } from "./catalog-view";

describe("catalogView", () => {
  it("mostra o erro só quando a lista ainda não chegou", () => {
    expect(catalogView({ isPending: false, isError: true, itemCount: null })).toBe("error");
    expect(catalogView({ isPending: true, isError: false, itemCount: null })).toBe("pending");
  });

  it("mantém os NFTs na tela quando uma releitura falha", () => {
    expect(catalogView({ isPending: false, isError: true, itemCount: 9 })).toBe("list");
  });

  it("mantém a lista vazia em vez de trocar por erro de releitura", () => {
    expect(catalogView({ isPending: false, isError: true, itemCount: 0 })).toBe("empty");
    expect(catalogView({ isPending: false, isError: false, itemCount: 9 })).toBe("list");
  });
});
