import { useLocation, useNavigate } from "@tanstack/react-router";
import { CancelledError, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useSession } from "@/features/auth/session";
import {
  captureSessionIdentity,
  isCurrentSession,
  privateQueryKey,
  type SessionIdentity,
} from "@/features/auth/session-identity";
import { isUnauthorized } from "@/features/nft/api";
import { api } from "@/shared/api/client";
import { pushToast } from "@/shared/ui/toast";

const favoritesResponseSchema = z.object({ favorites: z.array(z.string()) });

export function favoritesKey(userId: string) {
  return privateQueryKey(userId, "favorites");
}

/** Regra pura: remove o slug se já está na lista, senão o acrescenta ao fim. */
export function toggleFavoriteList(ids: string[], slug: string): string[] {
  return ids.includes(slug) ? ids.filter((id) => id !== slug) : [...ids, slug];
}

async function fetchFavorites(signal: AbortSignal): Promise<string[]> {
  const identity = captureSessionIdentity();
  const { data } = await api.get("/favorites", { signal });
  if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
  return favoritesResponseSchema.parse(data).favorites;
}

async function persistFavorite({ slug, favorite }: { slug: string; favorite: boolean }): Promise<string[]> {
  const identity = captureSessionIdentity();
  const path = `/favorites/${encodeURIComponent(slug)}`;
  const { data } = favorite ? await api.put(path) : await api.delete(path);
  if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
  return favoritesResponseSchema.parse(data).favorites;
}

type FavoriteContext = {
  identity: SessionIdentity;
  key: readonly unknown[];
  snapshot: string[] | undefined;
};

/** Atualização otimista. Depois de cancelar leituras, a sessão pode já ter mudado. */
export async function prepareFavoriteToggle(
  client: QueryClient,
  target: string,
  identity: SessionIdentity,
): Promise<FavoriteContext> {
  if (!identity.userId) return { identity, key: ["favorites", "anonymous"], snapshot: undefined };
  const scoped = favoritesKey(identity.userId);
  await client.cancelQueries({ queryKey: scoped });
  if (!isCurrentSession(identity)) return { identity, key: scoped, snapshot: undefined };
  const snapshot = client.getQueryData<string[]>(scoped);
  client.setQueryData<string[]>(scoped, toggleFavoriteList(snapshot ?? [], target));
  return { snapshot, identity, key: scoped };
}

/** Favoritos do usuário logado e a ação de alternar um NFT, com atualização otimista. */
export function useFavorite(slug: string) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const userId = session.data?.id;
  const key = userId ? favoritesKey(userId) : (["favorites", "anonymous"] as const);

  const list = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchFavorites(signal),
    enabled: userId !== undefined,
  });

  const mutation = useMutation({
    mutationFn: persistFavorite,
    onMutate: ({ slug: target }) => prepareFavoriteToggle(client, target, captureSessionIdentity()),
    onSuccess: (_data, variables, context) => {
      if (!context || !isCurrentSession(context.identity)) return;
      if (variables.favorite) pushToast("Adicionado aos favoritos");
    },
    onError: (error, _variables, context) => {
      if (!context || !isCurrentSession(context.identity)) return;
      client.setQueryData(context.key, context.snapshot);
      if (isUnauthorized(error)) {
        void navigate({ to: "/login", search: { redirect: location.href } });
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      if (!context || !isCurrentSession(context.identity)) return;
      void client.invalidateQueries({ queryKey: context.key });
    },
  });

  const isFavorite = list.data?.includes(slug) ?? false;

  function toggle() {
    // Visitante vai ao login; nada é gravado localmente.
    if (!userId) {
      void navigate({ to: "/login", search: { redirect: location.href } });
      return;
    }
    if (mutation.isPending) return;
    mutation.mutate({ slug, favorite: !isFavorite });
  }

  return {
    isFavorite,
    // Query desabilitada (visitante) fica `isPending` no TanStack Query v5 — não bloquear o botão.
    isPending: mutation.isPending || (userId !== undefined && list.isPending),
    isError: mutation.isError || (userId !== undefined && list.isError),
    error: mutation.error ?? list.error,
    retry: () => {
      if (list.isError) void list.refetch();
      if (mutation.isError) mutation.reset();
    },
    toggle,
  };
}
