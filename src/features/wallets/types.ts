import { z } from "zod";

export const WALLET_NETWORKS = ["ethereum", "polygon", "solana"] as const;
export const WALLET_PROVIDERS = ["metamask", "walletconnect", "coinbase"] as const;

export type WalletNetwork = (typeof WALLET_NETWORKS)[number];
export type WalletProvider = (typeof WALLET_PROVIDERS)[number];

export const NETWORK_LABELS: Record<WalletNetwork, string> = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  solana: "Solana",
};

export const PROVIDER_LABELS: Record<WalletProvider, string> = {
  metamask: "MetaMask",
  walletconnect: "WalletConnect",
  coinbase: "Coinbase Wallet",
};

export const walletSchema = z.object({
  id: z.string(),
  label: z.string(),
  address: z.string(),
  network: z.enum(WALLET_NETWORKS),
  provider: z.enum(WALLET_PROVIDERS),
  connected: z.boolean(),
});

export const walletListSchema = z.object({ wallets: z.array(walletSchema) });
export const walletResponseSchema = z.object({ wallet: walletSchema });

export type Wallet = z.infer<typeof walletSchema>;

export type NewWallet = {
  label: string;
  address: string;
  network: WalletNetwork;
  provider: WalletProvider;
};

export type WalletAction = "connect" | "reject" | "disconnect";

export function isWalletNetwork(value: unknown): value is WalletNetwork {
  return typeof value === "string" && (WALLET_NETWORKS as readonly string[]).includes(value);
}

export function isWalletProvider(value: unknown): value is WalletProvider {
  return typeof value === "string" && (WALLET_PROVIDERS as readonly string[]).includes(value);
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Formato do endereço por rede. Ethereum e Polygon usam 0x + 40 hex; Solana usa base58. */
export function isValidWalletAddress(network: WalletNetwork, address: string): boolean {
  return (network === "solana" ? SOLANA_ADDRESS : EVM_ADDRESS).test(address);
}

/** "0x4a1c9be2d03f7a85c6e1b2f09d34a7c85e61f0b3" vira "0x4A1C…F0B3". */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  if (address.startsWith("0x")) return `0x${address.slice(2, 6).toUpperCase()}…${address.slice(-4).toUpperCase()}`;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
