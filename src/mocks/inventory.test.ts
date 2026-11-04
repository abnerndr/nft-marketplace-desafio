import { beforeEach, describe, expect, it, vi } from "vitest";
import { initMockState, getDatabase } from "./db";
import {
  availableEditions,
  availableOf,
  commitInventory,
  releaseInventory,
  reserveInventory,
  validateInventory,
} from "./inventory";

vi.stubGlobal("location", new URL("http://kurio.test/"));

describe("inventory", () => {
  beforeEach(() => initMockState("?reset=1"));

  it("compra 1 de edição com 2 deixa 1; segunda compra de 2 conflita", () => {
    const slug = "emerald-ape-042";
    const editionId = "ed-1-10";
    expect(availableOf(slug, editionId)).toBe(2);

    expect(reserveInventory("order-1", [{ slug, editionId, quantity: 1 }])).toEqual({ ok: true });
    commitInventory("order-1");
    expect(availableOf(slug, editionId)).toBe(1);

    expect(reserveInventory("order-2", [{ slug, editionId, quantity: 2 }]).ok).toBe(false);
    expect(availableOf(slug, editionId)).toBe(1);
  });

  it("teto agregado impede 5+5 em edições diferentes com saldo 5", () => {
    const slug = "emerald-ape-042";
    expect(getDatabase().nfts.find((nft) => nft.slug === slug)?.available).toBe(5);

    const lines = [
      { slug, editionId: "ed-1-50", quantity: 5 },
      { slug, editionId: "ed-open", quantity: 5 },
    ];
    expect(validateInventory(lines).ok).toBe(false);
    expect(reserveInventory("order-agg", lines).ok).toBe(false);
    expect(availableOf(slug, "ed-1-50")).toBe(5);
    expect(availableOf(slug, "ed-open")).toBe(5);
    expect(getDatabase().nfts.find((nft) => nft.slug === slug)?.available).toBe(5);
  });

  it("dois pedidos não reservam as mesmas unidades; commit é idempotente", () => {
    const slug = "violet-nomad-314";
    const editionId = "ed-1-50";
    // violet tem available 2
    const lines = [{ slug, editionId, quantity: 2 }];
    expect(reserveInventory("order-a", lines)).toEqual({ ok: true });
    expect(reserveInventory("order-b", lines).ok).toBe(false);
    commitInventory("order-a");
    commitInventory("order-a");
    expect(availableEditions(slug).find((edition) => edition.id === editionId)?.available).toBe(0);
    expect(getDatabase().nfts.find((nft) => nft.slug === slug)?.available).toBe(0);
  });

  it("release devolve a reserva", () => {
    const slug = "sage-nomad-009";
    const editionId = "ed-1-50";
    const before = availableOf(slug, editionId);
    expect(reserveInventory("order-r", [{ slug, editionId, quantity: 1 }]).ok).toBe(true);
    expect(availableOf(slug, editionId)).toBe(before - 1);
    releaseInventory("order-r");
    expect(availableOf(slug, editionId)).toBe(before);
  });
});
