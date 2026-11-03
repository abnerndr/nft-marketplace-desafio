import { describe, expect, it } from "vitest";
import { nftSummarySchema } from "@/shared/domain/contracts";
import { getDatabase, resetDatabase, setScenario } from "./db";
import { applyScenario, getScenario, shouldFailTransient } from "./scenarios";
import { createSeed } from "./seed";

describe("createSeed", () => {
  it("cria 36 NFTs que passam no schema", () => {
    const db = createSeed();
    expect(db.nfts).toHaveLength(36);
    for (const nft of db.nfts) {
      expect(nftSummarySchema.safeParse(nft).success).toBe(true);
    }
  });

  it("inclui emerald-ape-042 a 1.19", () => {
    const nft = createSeed().nfts.find((n) => n.slug === "emerald-ape-042");
    expect(nft?.priceEth).toBe("1.19");
  });

  it("tem slugs únicos e 9+ itens em digital-art", () => {
    const { nfts } = createSeed();
    expect(new Set(nfts.map((n) => n.slug)).size).toBe(36);
    expect(nfts.filter((n) => n.collection === "digital-art").length).toBeGreaterThanOrEqual(9);
  });

  it("não guarda a senha em texto nos usuários", () => {
    const { users } = createSeed();
    expect(users).toHaveLength(2);
    const dump = JSON.stringify(users);
    expect(dump).not.toContain("Marina#2026");
    expect(dump).not.toContain("Rafael#2026");
    for (const u of users) expect(u.passwordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("Marina tem 1 favorito e 2 carteiras; Rafael nenhum; carrinhos vazios; sem pedidos", () => {
    const db = createSeed();
    const marina = db.users.find((u) => u.email.startsWith("marina"))!;
    const rafael = db.users.find((u) => u.email.startsWith("rafael"))!;
    expect(db.favorites[marina.id]).toEqual(["emerald-ape-042"]);
    expect(db.wallets[marina.id]).toHaveLength(2);
    expect(db.favorites[rafael.id]).toEqual([]);
    expect(db.wallets[rafael.id]).toEqual([]);
    expect(db.carts[marina.id]).toEqual({ items: [], couponCode: null });
    expect(db.carts[rafael.id]).toEqual({ items: [], couponCode: null });
    expect(db.orders).toEqual([]);
  });

  it("retorna instâncias independentes", () => {
    const a = createSeed();
    a.nfts[0].priceEth = "99";
    expect(createSeed().nfts[0].priceEth).not.toBe("99");
  });
});

describe("cenários", () => {
  it("shouldFailTransient falha só nas duas primeiras leituras em server-error", () => {
    applyScenario("server-error");
    expect(shouldFailTransient("/api/nfts")).toBe(true);
    expect(shouldFailTransient("/api/nfts?page=1")).toBe(true);
    expect(shouldFailTransient("/api/nfts")).toBe(false);
    expect(shouldFailTransient("/api/nfts/emerald-ape-042")).toBe(true);
    expect(shouldFailTransient("/api/nfts/emerald-ape-042")).toBe(true);
    expect(shouldFailTransient("/api/nfts/emerald-ape-042")).toBe(false);
    expect(shouldFailTransient("/api/health")).toBe(false);
    applyScenario("default");
    expect(shouldFailTransient("/api/nfts")).toBe(false);
  });

  it("resetDatabase volta ao seed e getScenario reflete o cenário", () => {
    setScenario("slow-network");
    expect(getScenario()).toBe("slow-network");
    getDatabase().nfts.pop();
    resetDatabase();
    expect(getDatabase().nfts).toHaveLength(36);
    setScenario("default");
  });
});
