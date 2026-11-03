import { useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useSession } from "@/features/auth/session";
import { isUnauthorized } from "@/features/nft/api";
import { api } from "@/shared/api/client";

const favoritesResponseSchema = z.object({ favorites: z.array(z.string()) });

export function favoritesKey(userId: string | undefined) {
  return ["favorites", userId] as const;
}

/** Regra pura: remove o slug se já está na lista, senão o acrescenta ao fim. */
export function toggleFavoriteList(ids: string[], slug: string): string[] {
  return ids.includes(slug) ? ids.filter((id) => id !== slug) : [...ids, slug];
}

async function fetchFavorites(signal?: AbortSignal): Promise<string[]> {
  const { data } = await api.get("/favorites", { signal });
  return favoritesResponseSchema.parse(data).favorites;
}

async function persistFavorite({ slug, favorite }: { slug: string; favorite: boolean }): Promise<string[]> {
  const path = `/favorites/${encodeURIComponent(slug)}`;
  const { data } = favorite ? await api.put(path) : await api.delete(path);
  return favoritesResponseSchema.parse(data).favorites;
}

/** Favoritos do usuário logado e a ação de alternar um NFT, com atualização otimista. */
export function useFavorite(slug: string) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const userId = session.data?.id;
  const key = favoritesKey(userId);

  const list = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchFavorites(signal),
    enabled: userId !== undefined,
  });

  const mutation = useMutation({
    mutationFn: persistFavorite,
    onMutate: async ({ slug: target }) => {
      await client.cancelQueries({ queryKey: key });
      const snapshot = client.getQueryData<string[]>(key);
      client.setQueryData<string[]>(key, toggleFavoriteList(snapshot ?? [], target));
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      client.setQueryData(key, context?.snapshot);
      if (isUnauthorized(error)) {
        void navigate({ to: "/login", search: { redirect: location.href } });
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
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

  return { isFavorite, isPending: mutation.isPending, toggle };
}
