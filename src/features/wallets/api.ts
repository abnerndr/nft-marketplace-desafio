import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import {
  walletListSchema,
  walletResponseSchema,
  type NewWallet,
  type WalletAction,
} from "./types";

export const walletsQueryKey = ["wallets"] as const;

export const walletsQuery = queryOptions({
  queryKey: walletsQueryKey,
  queryFn: async () => {
    const { data } = await api.get("/wallets");
    return walletListSchema.parse(data).wallets;
  },
});

export function useWallets() {
  return useQuery(walletsQuery);
}

export function useAddWallet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewWallet) => {
      const { data } = await api.post("/wallets", input);
      return walletResponseSchema.parse(data).wallet;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: walletsQueryKey }),
  });
}

/** Conecta, recusa (simulado) ou desconecta. A recusa volta como erro `wallet-connect-rejected`. */
export function useWalletAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: WalletAction }) => {
      const { data } = await api.patch(`/wallets/${encodeURIComponent(id)}`, { action });
      return walletResponseSchema.parse(data).wallet;
    },
    onSettled: () => client.invalidateQueries({ queryKey: walletsQueryKey }),
  });
}
