import type { GuestItem } from "./guest-cart";

export const MERGE_ATTEMPT_PREFIX = "kurio.merge-attempt.";

export type GuestMergeAttempt = {
  userId: string;
  mergeId: string;
  lines: GuestItem[];
  couponCode: string | null;
};

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function keyOf(userId: string): string {
  return `${MERGE_ATTEMPT_PREFIX}${userId}`;
}

export function readMergeAttempt(userId: string): GuestMergeAttempt | null {
  try {
    const raw = sessionStore()?.getItem(keyOf(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { userId: owner, mergeId, lines, couponCode } = parsed as Record<string, unknown>;
    if (owner !== userId || typeof mergeId !== "string" || !Array.isArray(lines)) return null;
    return {
      userId,
      mergeId,
      lines: lines as GuestItem[],
      couponCode: typeof couponCode === "string" ? couponCode : null,
    };
  } catch {
    return null;
  }
}

export function writeMergeAttempt(attempt: GuestMergeAttempt): void {
  try {
    sessionStore()?.setItem(keyOf(attempt.userId), JSON.stringify(attempt));
  } catch {
    // sem sessionStorage a tentativa só vive na memória da chamada
  }
}

export function clearMergeAttempt(userId: string): void {
  try {
    sessionStore()?.removeItem(keyOf(userId));
  } catch {
    // ignora
  }
}

export function newMergeId(): string {
  return crypto.randomUUID();
}
