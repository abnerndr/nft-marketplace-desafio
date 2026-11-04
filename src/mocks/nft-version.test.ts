import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, initMockState } from "./db";
import { applyPriceChange, nftVersionOf, raisedPrice } from "./nft-version";
import { quoteFor } from "./handlers/quote";

describe("versão de preço do mock", () => {
  beforeEach(() => {
    initMockState("?reset=1");
  });

  it("sobe 10% mantendo as casas decimais", () => {
    expect(raisedPrice("1.19")).toBe("1.309");
    expect(raisedPrice("0.39")).toBe("0.429");
  });

  it("grava preço e versão e ignora versão igual ou antiga", () => {
    expect(nftVersionOf("emerald-ape-042")).toBe(1);
    expect(applyPriceChange({ slug: "emerald-ape-042", priceEth: "1.31", version: 2 })).toBe(true);
    expect(applyPriceChange({ slug: "emerald-ape-042", priceEth: "0.50", version: 2 })).toBe(false);
    expect(applyPriceChange({ slug: "emerald-ape-042", priceEth: "0.50", version: 1 })).toBe(false);
    expect(getDatabase().nfts.find((nft) => nft.slug === "emerald-ape-042")?.priceEth).toBe("1.31");
    expect(nftVersionOf("emerald-ape-042")).toBe(2);
  });

  it("a próxima cotação carrega outra versão, então a confirmação com a revisão antiga não passa", () => {
    const items = [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1 }];
    const before = quoteFor(items, "");
    applyPriceChange({ slug: "emerald-ape-042", priceEth: "1.31", version: 2 });
    const after = quoteFor(items, "");
    expect(before.ok && after.ok && after.quote.version !== before.quote.version).toBe(true);
    expect(after.ok && after.quote.subtotalEth).toBe("1.31");
  });

  it("muda a versão quando sobe o preço de um item que NÃO é o de maior versão", () => {
    const items = [
      { slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1 },
      { slug: "sage-nomad-009", editionId: "ed-1-50", quantity: 1 },
    ];
    // O primeiro item já está na versão 3; o segundo sobe da 1 para a 2, abaixo do máximo.
    applyPriceChange({ slug: "emerald-ape-042", priceEth: "1.40", version: 3 });
    const before = quoteFor(items, "");
    applyPriceChange({ slug: "sage-nomad-009", priceEth: "1.86", version: 2 });
    const after = quoteFor(items, "");
    expect(before.ok && after.ok && after.quote.version !== before.quote.version).toBe(true);
  });

  it("muda a versão com a quantidade e com o cupom, e repete com a mesma entrada", () => {
    const one = [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1 }];
    const two = [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 2 }];
    const version = (items: typeof one, coupon = "") => {
      const result = quoteFor(items, coupon);
      if (!result.ok) throw new Error("cotação falhou");
      return result.quote.version;
    };
    expect(version(one)).toBe(version(one));
    expect(version(two)).not.toBe(version(one));
    expect(version(one, "GENESIS10")).not.toBe(version(one));
  });

  it("cotação de outro item não herda a versão", () => {
    const items = [{ slug: "sage-nomad-009", editionId: "ed-1-50", quantity: 1 }];
    const before = quoteFor(items, "");
    applyPriceChange({ slug: "emerald-ape-042", priceEth: "1.31", version: 2 });
    const after = quoteFor(items, "");
    expect(before.ok && after.ok && after.quote.version === before.quote.version).toBe(true);
  });
});
