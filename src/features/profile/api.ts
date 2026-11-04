import { CancelledError, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionQueryKey, useSession } from "@/features/auth/session";
import {
  captureSessionIdentity,
  isCurrentSession,
  privateQueryKey,
  type SessionIdentity,
} from "@/features/auth/session-identity";
import { api } from "@/shared/api/client";
import {
  profileResponseSchema,
  type PasswordChange,
  type Profile,
  type ProfileUpdate,
} from "./types";

export function profileQueryKey(userId: string) {
  return privateQueryKey(userId, "profile");
}

function canWrite(identity: SessionIdentity | undefined): identity is SessionIdentity & { userId: string } {
  return identity !== undefined && identity.userId !== null && isCurrentSession(identity);
}

export function useProfile() {
  const userId = useSession().data?.id;
  return useQuery({
    queryKey: userId ? profileQueryKey(userId) : ["profile", "anonymous"],
    queryFn: async ({ signal }) => {
      const identity = captureSessionIdentity();
      const { data } = await api.get("/profile", { signal });
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return profileResponseSchema.parse(data).profile;
    },
    enabled: Boolean(userId),
  });
}

/** Guarda o perfil novo e renova a sessão: o nome e o e-mail do usuário logado mudaram. */
function storeProfile(client: ReturnType<typeof useQueryClient>, profile: Profile, identity: SessionIdentity | undefined) {
  if (!canWrite(identity)) return;
  client.setQueryData(profileQueryKey(identity.userId), profile);
  void client.invalidateQueries({ queryKey: sessionQueryKey });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileUpdate) => {
      const identity = captureSessionIdentity();
      const { data } = await api.patch("/profile", input);
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return profileResponseSchema.parse(data).profile;
    },
    onMutate: () => captureSessionIdentity(),
    onSuccess: (profile, _input, identity) => storeProfile(client, profile, identity),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: PasswordChange) => {
      const identity = captureSessionIdentity();
      await api.post("/profile/password", input);
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
    },
  });
}

/** `dataUrl` nulo remove o avatar. */
export function useUpdateAvatar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (dataUrl: string | null) => {
      const identity = captureSessionIdentity();
      const { data } = await api.post("/profile/avatar", { dataUrl });
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return profileResponseSchema.parse(data).profile;
    },
    onMutate: () => captureSessionIdentity(),
    onSuccess: (profile, _input, identity) => storeProfile(client, profile, identity),
  });
}
