import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { api } from "@/shared/api/client";
import { userSchema, type User } from "@/shared/domain/contracts";
import { queryClient } from "@/shared/api/query-client";
import { syncGuestCart, syncGuestCoupon } from "@/features/cart/sync";
import { z } from "zod";

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

async function fetchSession(): Promise<User | null> {
  if (!readSessionToken()) return null;
  try {
    const { data } = await api.get("/auth/session");
    return sessionResponseSchema.parse(data).user;
  } catch (error) {
    if ((error as { response?: { status?: number } }).response?.status === 401) {
      clearSessionToken();
      return null;
    }
    throw error;
  }
}

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: fetchSession,
  staleTime: 30_000,
});

/** Usuário logado ou `null`. */
export function useSession() {
  return useQuery(sessionQueryOptions);
}

export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { name: string };

async function authenticate(path: string, body: LoginInput | RegisterInput): Promise<User> {
  const { data } = await api.post(path, body);
  const { user, token } = authResponseSchema.parse(data);
  writeSessionToken(token);
  // O carrinho de visitante sobe uma vez; falha aqui não pode derrubar o login.
  await syncGuestCart().catch(() => undefined);
  await syncGuestCoupon().catch(() => undefined);
  return user;
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authenticate("/auth/login", input),
    onSuccess: async (user) => {
      client.setQueryData(sessionQueryKey, user);
      await client.invalidateQueries({ queryKey: sessionQueryKey });
      await client.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useRegister() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => authenticate("/auth/register", input),
    onSuccess: async (user) => {
      client.setQueryData(sessionQueryKey, user);
      await client.invalidateQueries({ queryKey: sessionQueryKey });
      await client.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.post("/auth/logout");
      } finally {
        clearSessionToken();
      }
    },
    onSettled: () => {
      client.setQueryData(sessionQueryKey, null);
      client.removeQueries({ queryKey: ["cart"] });
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
