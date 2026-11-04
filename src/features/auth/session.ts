import { CancelledError, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { isAxiosError, isCancel } from "axios";
import { useRef } from "react";
import { api } from "@/shared/api/client";
import { userSchema, type User } from "@/shared/domain/contracts";
import { queryClient } from "@/shared/api/query-client";
import { syncGuestCart, syncGuestCoupon } from "@/features/cart/sync";
import { z } from "zod";
import {
  captureSessionIdentity,
  isCurrentSession,
  privateQueryKey,
  setSessionIdentity,
  type SessionIdentity,
} from "./session-identity";

export const SESSION_STORAGE_KEY = "kurio.session";
export const sessionQueryKey = ["session"] as const;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Token opaco da sessão; `null` quando não há login. */
export function readSessionToken(): string | null {
  return storage()?.getItem(SESSION_STORAGE_KEY) ?? null;
}

export function writeSessionToken(token: string): void {
  storage()?.setItem(SESSION_STORAGE_KEY, token);
}

export function clearSessionToken(): void {
  storage()?.removeItem(SESSION_STORAGE_KEY);
}

/** Leitura que começou noutra geração não pode gravar o cache da sessão atual. */
export function ensureCurrentSession(identity: SessionIdentity): void {
  if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
}

const authResponseSchema = z.object({ user: userSchema, token: z.string() });
const sessionResponseSchema = z.object({ user: userSchema });

/** Só caminhos internos voltam do login; qualquer outra coisa vira `/`. */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  return value;
}

const PRIVATE_PREFIXES = ["/checkout", "/orders", "/account"] as const;

/** Espelha as rotas com `beforeLoad: requireAuth`: o que exige sessão para existir. */
export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function adoptSessionUser(userId: string): void {
  if (captureSessionIdentity().userId !== userId) setSessionIdentity(userId);
}

async function fetchSession(signal: AbortSignal): Promise<User | null> {
  const token = readSessionToken();
  if (!token) return null;
  try {
    const { data } = await api.get("/auth/session", { signal });
    if (readSessionToken() !== token) throw new CancelledError({ silent: true });
    const user = sessionResponseSchema.parse(data).user;
    const now = captureSessionIdentity();
    if (now.userId !== null && now.userId !== user.id) throw new CancelledError({ silent: true });
    adoptSessionUser(user.id);
    return user;
  } catch (error) {
    if (error instanceof CancelledError || isCancel(error) || signal.aborted) throw error;
    if (isAxiosError(error) && error.response?.status === 401) {
      const tokenNow = readSessionToken();
      // Outra conta já instalou o token dela: este 401 ficou para trás.
      if (tokenNow !== null && tokenNow !== token) throw new CancelledError({ silent: true });
      if (tokenNow === token) {
        clearSessionToken();
        setSessionIdentity(null);
      }
      return null;
    }
    throw error;
  }
}

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: ({ signal }) => fetchSession(signal),
  staleTime: 30_000,
});

/** Usuário logado ou `null`. */
export function useSession() {
  return useQuery(sessionQueryOptions);
}

export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { name: string };

async function authenticate(path: string, body: LoginInput | RegisterInput): Promise<User> {
  const identity = captureSessionIdentity();
  const { data } = await api.post(path, body);
  ensureCurrentSession(identity);
  const { user, token } = authResponseSchema.parse(data);
  writeSessionToken(token);
  setSessionIdentity(user.id);
  // O carrinho de visitante sobe uma vez; falha aqui não pode derrubar o login.
  await syncGuestCart().catch(() => undefined);
  await syncGuestCoupon().catch(() => undefined);
  return user;
}

function publishSession(client: ReturnType<typeof useQueryClient>, user: User) {
  if (captureSessionIdentity().userId !== user.id) return Promise.resolve();
  client.setQueryData(sessionQueryKey, user);
  return Promise.all([
    client.invalidateQueries({ queryKey: sessionQueryKey }),
    client.invalidateQueries({ queryKey: privateQueryKey(user.id, "cart") }),
    client.invalidateQueries({ queryKey: ["cart"] }),
  ]);
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authenticate("/auth/login", input),
    onSuccess: (user) => publishSession(client, user),
  });
}

export function useRegister() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => authenticate("/auth/register", input),
    onSuccess: (user) => publishSession(client, user),
  });
}

export function useLogout() {
  const client = useQueryClient();
  const outcome = useRef({ cleared: false });
  return useMutation({
    mutationFn: async () => {
      const identity = captureSessionIdentity();
      outcome.current = { cleared: false };
      try {
        await api.post("/auth/logout");
      } finally {
        if (isCurrentSession(identity)) {
          clearSessionToken();
          setSessionIdentity(null);
          outcome.current.cleared = true;
        }
      }
    },
    onSettled: () => {
      if (!outcome.current.cleared) return;
      outcome.current.cleared = false;
      client.setQueryData(sessionQueryKey, null);
      void client.cancelQueries({ queryKey: ["private"] });
      client.removeQueries({ queryKey: ["private"] });
    },
  });
}

/**
 * `beforeLoad` das rotas privadas. Sem sessão válida, manda para `/login`
 * guardando o destino em `redirect` para voltar depois.
 */
export async function requireAuth({ location }: { location: { href: string } }): Promise<void> {
  const user = await queryClient.fetchQuery(sessionQueryOptions);
  if (!user) {
    throw redirect({ to: "/login", search: { redirect: safeRedirect(location.href) } });
  }
}
