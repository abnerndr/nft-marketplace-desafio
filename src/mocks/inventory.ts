import type { Edition } from "@/shared/domain/contracts";
import { getDatabase, saveDatabase } from "./db";
import type { EditionStockRecord, InventoryReservation } from "./seed";

export type EditionStock = { slug: string; editionId: string; remaining: number; version: number };
export type InventoryLine = { slug: string; editionId: string; quantity: number };
export type InventoryResult =
  | { ok: true }
  | { ok: false; conflicts: Array<InventoryLine & { available: number }> };

export const EDITION_LABELS: Record<string, string> = {
  "ed-1-1": "1/1",
  "ed-1-10": "1/10",
  "ed-1-50": "1/50",
  "ed-open": "ABERTA",
};

export const EDITION_IDS = Object.keys(EDITION_LABELS);

export function stockKey(slug: string, editionId: string): string {
  return `${slug}::${editionId}`;
}

/** Saldo inicial por edição a partir do teto agregado do NFT. 1/1 fica esgotada. */
export function initialEditionStocks(slug: string, aggregate: number): EditionStockRecord[] {
  return [
    { slug, editionId: "ed-1-1", remaining: 0, version: 1 },
    { slug, editionId: "ed-1-10", remaining: Math.floor(aggregate / 2), version: 1 },
    { slug, editionId: "ed-1-50", remaining: aggregate, version: 1 },
    { slug, editionId: "ed-open", remaining: aggregate, version: 1 },
  ];
}

function ensureInventoryTables(): void {
  const db = getDatabase();
  db.editionStock ??= {};
  db.reservations ??= {};
  if (Object.keys(db.editionStock).length === 0) {
    for (const nft of db.nfts) {
      for (const stock of initialEditionStocks(nft.slug, nft.available)) {
        db.editionStock[stockKey(stock.slug, stock.editionId)] = stock;
      }
    }
    saveDatabase();
  }
}

function readStock(slug: string, editionId: string): EditionStockRecord | undefined {
  ensureInventoryTables();
  return getDatabase().editionStock?.[stockKey(slug, editionId)];
}

function aggregateRemaining(slug: string): number {
  return getDatabase().nfts.find((nft) => nft.slug === slug)?.available ?? 0;
}

/** Unidades ainda vendáveis da edição (já descontadas reservas/commits). */
export function availableOf(slug: string, editionId: string): number {
  return readStock(slug, editionId)?.remaining ?? 0;
}

export function availableEditions(slug: string): Edition[] {
  ensureInventoryTables();
  return EDITION_IDS.map((editionId) => ({
    id: editionId,
    label: EDITION_LABELS[editionId] ?? editionId,
    available: availableOf(slug, editionId),
  }));
}

/**
 * Valida linhas contra saldo por edição e teto agregado do NFT.
 * Não muta o banco. Conflitos listam o disponível real por linha.
 */
export function validateInventory(lines: InventoryLine[]): InventoryResult {
  ensureInventoryTables();
  const conflicts: Array<InventoryLine & { available: number }> = [];
  const requestedByEdition = new Map<string, number>();
  const requestedBySlug = new Map<string, number>();

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      conflicts.push({ ...line, available: availableOf(line.slug, line.editionId) });
      continue;
    }
    const key = stockKey(line.slug, line.editionId);
    requestedByEdition.set(key, (requestedByEdition.get(key) ?? 0) + line.quantity);
    requestedBySlug.set(line.slug, (requestedBySlug.get(line.slug) ?? 0) + line.quantity);
  }

  for (const line of lines) {
    const key = stockKey(line.slug, line.editionId);
    const stock = readStock(line.slug, line.editionId);
    const needed = requestedByEdition.get(key) ?? line.quantity;
    const editionAvailable = stock?.remaining ?? 0;
    if (!stock || needed > editionAvailable) {
      if (!conflicts.some((c) => c.slug === line.slug && c.editionId === line.editionId)) {
        conflicts.push({ slug: line.slug, editionId: line.editionId, quantity: line.quantity, available: editionAvailable });
      }
    }
  }

  for (const [slug, needed] of requestedBySlug) {
    const aggregate = aggregateRemaining(slug);
    if (needed > aggregate) {
      for (const line of lines.filter((item) => item.slug === slug)) {
        if (!conflicts.some((c) => c.slug === line.slug && c.editionId === line.editionId)) {
          conflicts.push({
            slug: line.slug,
            editionId: line.editionId,
            quantity: line.quantity,
            available: Math.min(availableOf(line.slug, line.editionId), aggregate),
          });
        }
      }
    }
  }

  return conflicts.length > 0 ? { ok: false, conflicts } : { ok: true };
}

function applyDelta(lines: InventoryLine[], sign: 1 | -1): void {
  const db = getDatabase();
  ensureInventoryTables();
  const bySlug = new Map<string, number>();
  for (const line of lines) {
    const stock = db.editionStock![stockKey(line.slug, line.editionId)];
    if (!stock) continue;
    stock.remaining += sign * line.quantity;
    stock.version += 1;
    bySlug.set(line.slug, (bySlug.get(line.slug) ?? 0) + line.quantity);
  }
  for (const [slug, qty] of bySlug) {
    const nft = db.nfts.find((candidate) => candidate.slug === slug);
    if (nft) nft.available = Math.max(0, nft.available + sign * qty);
  }
}

/** Reserva atômica: baixa saldo agora; commit só marca a reserva como consumida. */
export function reserveInventory(orderId: string, lines: InventoryLine[]): InventoryResult {
  ensureInventoryTables();
  const db = getDatabase();
  if (db.reservations![orderId]) {
    return { ok: true };
  }
  const check = validateInventory(lines);
  if (!check.ok) return check;
  applyDelta(lines, -1);
  db.reservations![orderId] = { lines, state: "reserved" };
  saveDatabase();
  return { ok: true };
}

export function releaseInventory(orderId: string): void {
  ensureInventoryTables();
  const db = getDatabase();
  const reservation = db.reservations![orderId];
  if (!reservation || reservation.state !== "reserved") return;
  applyDelta(reservation.lines, 1);
  delete db.reservations![orderId];
  saveDatabase();
}

/** Consome a reserva uma única vez. Segunda chamada é no-op. */
export function commitInventory(orderId: string): void {
  ensureInventoryTables();
  const db = getDatabase();
  const reservation = db.reservations![orderId];
  if (!reservation || reservation.state !== "reserved") return;
  reservation.state = "committed";
  saveDatabase();
}

export function getReservation(orderId: string): InventoryReservation | undefined {
  ensureInventoryTables();
  return getDatabase().reservations?.[orderId];
}
