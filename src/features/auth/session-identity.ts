export type SessionIdentity = Readonly<{ userId: string | null; generation: number }>;

let current: SessionIdentity = { userId: null, generation: 0 };

export function setSessionIdentity(userId: string | null) {
  current = { userId, generation: current.generation + 1 };
}

export const captureSessionIdentity = (): SessionIdentity => ({ ...current });

export const isCurrentSession = (value: SessionIdentity) =>
  value.userId === current.userId && value.generation === current.generation;

export const privateQueryKey = (userId: string, ...parts: unknown[]) =>
  ["private", userId, ...parts] as const;
