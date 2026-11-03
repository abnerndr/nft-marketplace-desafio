import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { readSessionToken, useSession } from "@/features/auth/session";
import { cartQueryKey } from "@/features/cart/api";
import { quoteQueryKey } from "@/features/cart/quote";
import { walletsQueryKey } from "@/features/wallets/api";
import { clearPriceNotices } from "./notices";
import { connectRealtime } from "./socket";

/** Dados que pertencem à sessão: não podem sobrar para o próximo usuário. */
const PRIVATE_KEYS = [cartQueryKey, quoteQueryKey, ["order"], walletsQueryKey, ["favorites"]] as const;

/**
 * Mantém um socket por usuário logado. O efeito fecha o socket anterior no cleanup, e a troca
 * (ou saída) de usuário limpa favoritos, carrinho, cotações, carteiras e pedidos da sessão anterior.
 * Visitante não abre socket: não há token.
 */
export function useRealtime(): void {
  const client = useQueryClient();
  const session = useSession();
  const userId = session.data?.id;

  useEffect(() => {
    if (!userId) return;
    const token = readSessionToken();
    if (!token) return;
    return connectRealtime({ token, userId, client });
  }, [client, userId]);

  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    const before = previous.current;
    previous.current = userId;
    // Visitante que entra (`before` indefinido) mantém o que já carregou; só descarta sessão anterior.
    if (before === undefined || before === userId) return;
    for (const key of PRIVATE_KEYS) client.removeQueries({ queryKey: key });
    clearPriceNotices();
  }, [client, userId]);
}
