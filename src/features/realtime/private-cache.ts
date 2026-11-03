import type { QueryClient } from "@tanstack/react-query";
import { cartQueryKey } from "@/features/cart/api";
import { quoteQueryKey } from "@/features/cart/quote";
import { profileQueryKey } from "@/features/profile/api";
import { walletsQueryKey } from "@/features/wallets/api";
import { clearPriceNotices } from "./notices";

/** Dados que pertencem à sessão: não podem sobrar para o próximo usuário. */
const PRIVATE_KEYS = [cartQueryKey, quoteQueryKey, ["order"], walletsQueryKey, profileQueryKey, ["favorites"]] as const;

/**
 * Troca de usuário (ou saída) descarta a sessão anterior. Visitante que entra (`before` indefinido)
 * mantém o que já carregou: só há o que descartar quando havia um usuário.
 */
export function shouldDropPrivateCache(before: string | undefined, after: string | undefined): boolean {
  return before !== undefined && before !== after;
}

export function dropPrivateCache(client: QueryClient): void {
  for (const key of PRIVATE_KEYS) client.removeQueries({ queryKey: key });
  clearPriceNotices();
}
