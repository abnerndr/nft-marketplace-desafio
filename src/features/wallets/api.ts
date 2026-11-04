import { CancelledError, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session";
import {
  captureSessionIdentity,
  isCurrentSession,
  privateQueryKey,
  type SessionIdentity,
} from "@/features/auth/session-identity";
import { api } from "@/shared/api/client";
import {
  walletListSchema,
  walletResponseSchema,
  type NewWallet,
  type WalletAction,
  type WalletUpdate,
} from "./types";

export function walletsQueryKey(userId: string) {
  return privateQueryKey(userId, "wallets");
}

function refreshWallets(client: ReturnType<typeof useQueryClient>, identity: SessionIdentity | undefined) {
  if (!identity || !isCurrentSession(identity) || !identity.userId) return;
  void client.invalidateQueries({ queryKey: walletsQueryKey(identity.userId) });
}

export function useWallets() {
  const userId = useSession().data?.id;
  return useQuery({
    queryKey: userId ? walletsQueryKey(userId) : ["wallets", "anonymous"],
    queryFn: async ({ signal }) => {
      const identity = captureSessionIdentity();
      const { data } = await api.get("/wallets", { signal });
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return walletListSchema.parse(data).wallets;
    },
    enabled: Boolean(userId),
  });
}

export function useAddWallet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewWallet) => {
      const identity = captureSessionIdentity();
      const { data } = await api.post("/wallets", input);
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return walletResponseSchema.parse(data).wallet;
    },
    onMutate: () => captureSessionIdentity(),
    onSuccess: (_wallet, _input, identity) => refreshWallets(client, identity),
  });
}

/** Conecta, recusa (simulado), desconecta ou define a principal. A recusa volta como erro `wallet-connect-rejected`. */
export function useWalletAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: WalletAction }) => {
      const identity = captureSessionIdentity();
      const { data } = await api.patch(`/wallets/${encodeURIComponent(id)}`, { action });
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return walletResponseSchema.parse(data).wallet;
    },
    onMutate: () => captureSessionIdentity(),
    onSettled: (_data, _error, _vars, identity) => refreshWallets(client, identity),
  });
}

/** Edita nome, endereço e rede da carteira já cadastrada. */
export function useUpdateWallet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & WalletUpdate) => {
      const identity = captureSessionIdentity();
      const { data } = await api.patch(`/wallets/${encodeURIComponent(id)}`, input);
      if (!isCurrentSession(identity)) throw new CancelledError({ silent: true });
      return walletResponseSchema.parse(data).wallet;
    },
    onMutate: () => captureSessionIdentity(),
    onSettled: (_data, _error, _vars, identity) => refreshWallets(client, identity),
  });
}
