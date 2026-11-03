import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionQueryKey } from "@/features/auth/session";
import { api } from "@/shared/api/client";
import {
  profileResponseSchema,
  type PasswordChange,
  type Profile,
  type ProfileUpdate,
} from "./types";

export const profileQueryKey = ["profile"] as const;

export const profileQuery = queryOptions({
  queryKey: profileQueryKey,
  queryFn: async () => {
    const { data } = await api.get("/profile");
    return profileResponseSchema.parse(data).profile;
  },
});

export function useProfile() {
  return useQuery(profileQuery);
}

/** Guarda o perfil novo e renova a sessão: o nome e o e-mail do usuário logado mudaram. */
function useStoreProfile() {
  const client = useQueryClient();
  return (profile: Profile) => {
    client.setQueryData(profileQueryKey, profile);
    void client.invalidateQueries({ queryKey: sessionQueryKey });
  };
}

export function useUpdateProfile() {
  const store = useStoreProfile();
  return useMutation({
    mutationFn: async (input: ProfileUpdate) => {
      const { data } = await api.patch("/profile", input);
      return profileResponseSchema.parse(data).profile;
    },
    onSuccess: store,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: PasswordChange) => {
      await api.post("/profile/password", input);
    },
  });
}

/** `dataUrl` nulo remove o avatar. */
export function useUpdateAvatar() {
  const store = useStoreProfile();
  return useMutation({
    mutationFn: async (dataUrl: string | null) => {
      const { data } = await api.post("/profile/avatar", { dataUrl });
      return profileResponseSchema.parse(data).profile;
    },
    onSuccess: store,
  });
}
