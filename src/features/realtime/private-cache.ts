import type { QueryClient } from "@tanstack/react-query";
import { clearPriceNotices } from "./notices";

/**
 * Troca de usuário (ou saída) descarta a sessão anterior. Visitante que entra (`before` indefinido)
 * mantém o que já carregou: só há o que descartar quando havia um usuário.
 * Carrinho de visitante (`["cart", "guest"]`) e catálogo ficam de fora: a chave privada é `private`.
 */
export function shouldDropPrivateCache(before: string | undefined, after: string | undefined): boolean {
  return before !== undefined && before !== after;
}

export function dropPrivateCache(client: QueryClient): void {
  void client.cancelQueries({ queryKey: ["private"] });
  client.removeQueries({ queryKey: ["private"] });
  clearPriceNotices();
}
