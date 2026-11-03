import { describe, expect, it } from "vitest";
import { mergeGuestCart } from "./merge";

describe("mergeGuestCart", () => {
  it("soma quantidades do mesmo editionId", () => {
    const merged = mergeGuestCart(
      [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 2, available: 5 }],
      [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1, available: 5 }],
    );
    expect(merged).toEqual([{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 3, available: 5 }]);
  });

  it("respeita available: a soma nunca passa do estoque", () => {
    const merged = mergeGuestCart(
      [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 4, available: 5 }],
      [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 3, available: 5 }],
    );
    expect(merged[0].quantity).toBe(5);
  });

  it("mantém separados o mesmo editionId de NFTs diferentes e itens sem par", () => {
    const merged = mergeGuestCart(
      [
        { slug: "violet-nomad-314", editionId: "ed-1-50", quantity: 1, available: 8 },
        { slug: "ivory-baron-088", editionId: "ed-open", quantity: 2, available: 3 },
      ],
      [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 2, available: 5 }],
    );
    expect(merged).toEqual([
      { slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 2, available: 5 },
      { slug: "violet-nomad-314", editionId: "ed-1-50", quantity: 1, available: 8 },
      { slug: "ivory-baron-088", editionId: "ed-open", quantity: 2, available: 3 },
    ]);
  });

  it("descarta item de edição esgotada e não muta as entradas", () => {
    const guest = [{ slug: "emerald-ape-042", editionId: "ed-1-1", quantity: 1, available: 0 }];
    const user = [{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1, available: 5 }];
    const merged = mergeGuestCart(guest, user);
    expect(merged).toEqual([{ slug: "emerald-ape-042", editionId: "ed-1-50", quantity: 1, available: 5 }]);
    expect(guest[0].quantity).toBe(1);
    expect(user[0].quantity).toBe(1);
  });
});
