import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { readSessionToken, useSession } from "@/features/auth/session";
import { waitForMocks } from "@/mocks/ready";
import { dropPrivateCache, shouldDropPrivateCache } from "./private-cache";
import { connectRealtime } from "./socket";

/**
 * Mantém um socket por sessão. O cleanup fecha o socket anterior. A troca (ou saída) cancela
 * leituras `private` ainda em voo e apaga esse cache; o callback do socket antigo não regrava,
 * porque a geração da sessão já mudou. Carrinho de visitante e catálogo permanecem.
 * Visitante também conecta, sem token, para receber `nft.updated` público.
 */
export function useRealtime(): void {
  const client = useQueryClient();
  const session = useSession();
  const userId = session.data?.id;
  const [mocksReady, setMocksReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void waitForMocks().then(() => {
      if (!cancelled) setMocksReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mocksReady || session.isPending) return;
    if (userId) {
      const token = readSessionToken();
      if (!token) return;
      return connectRealtime({ token, userId, client });
    }
    if (session.isSuccess) return connectRealtime({ client });
  }, [client, mocksReady, session.isPending, session.isSuccess, userId]);

  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    const before = previous.current;
    previous.current = userId;
    if (shouldDropPrivateCache(before, userId)) dropPrivateCache(client);
  }, [client, userId]);
}
