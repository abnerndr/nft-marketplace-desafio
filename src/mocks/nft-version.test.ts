import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, initMockState } from "./db";
import { applyPriceChange, nftVersionOf, raisedPrice } from "./nft-version";
import { quoteFor } from "./handlers/quote";

describe("versão de preço do mock", () => {
  beforeEach(() => {
    initMockState("?reset=1");
  });

  it("sobe 10% mantendo as casas decimais", () => {
    expect(raisedPrice("1.19")).toBe("1.31");
    expect(raisedPrice("0.39")).toBe("0.43");
  });

  it("grava preço e versão e ignora versão igual ou antiga", () => {
    expect(nftVersionOf("emerald-ape-042")).toBe(1);
    expect(applyPriceChange({ slug: "emerald-ape-042", priceEth: "1.31", version: 2 })).toBe(true);
    expect(applyPriceChange({ slug: "emerald-ape-042", priceEth: "0.50", version: 2 })).toBe(false);
    expect(applyPriceChange({ slug: "emerald-ape-042", priceEth: "0.50", version: 1 })).toBe(false);
    expect(getDatabase().nfts.find((nft) => nft.slug === "emerald-ape-042")?.priceEth).toBe("1.31");
    expect(nftVersionOf("emerald-ape-042")).toBe(2);
  });

  it("a próxima cotação carrega a versão nova, então a confirmação com a versão antiga não passa", () => {
    const items = [{ slug: "emerald-ape-042", quantity: 1 }];
    const before = quoteFor(items, "");
    expect(before.ok && before.quote.version).toBe(1);

    applyPriceChange({ slug: "emerald-ape-042", priceEth: "1.31", version: 2 });
    const after = quoteFor(items, "");
    expect(after.ok && after.quote.version).toBe(2);
    expect(after.ok && after.quote.subtotalEth).toBe("1.31");
  });

  it("cotação de outro item não herda a versão", () => {
    applyPriceChange({ slug: "emerald-ape-042", priceEth: "1.31", version: 2 });
    const other = quoteFor([{ slug: "sage-nomad-009", quantity: 1 }], "");
    expect(other.ok && other.quote.version).toBe(1);
  });
});
