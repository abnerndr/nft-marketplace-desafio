import { router } from "@/app/router";
import { setSessionIdentity } from "@/features/auth/session-identity";
import { clearSessionToken, isPrivatePath, safeRedirect, sessionQueryKey } from "@/features/auth/session";
import { setUnauthorizedHandler, type UnauthorizedInfo } from "@/shared/api/client";
import { queryClient } from "@/shared/api/query-client";

/**
 * Sessão vencida no meio da navegação ou do checkout: apaga o token, avança a geração, descarta o
 * cache privado e manda para `/login?redirect=<onde estava>`. Não mexe no carrinho de visitante nem
 * no rascunho do checkout (a tentativa de pedido guardada), para o usuário voltar e seguir de onde parou.
 */
export function handleSessionExpired({ url }: UnauthorizedInfo): void {
  clearSessionToken();
  setSessionIdentity(null);
  queryClient.setQueryData(sessionQueryKey, null);
  void queryClient.cancelQueries({ queryKey: ["private"] });
  queryClient.removeQueries({ queryKey: ["private"] });

  const here = router.history.location;
  if (here.pathname === "/login" || here.pathname === "/register") return;
  if (url.split("?")[0] === "/auth/session") {
    // Navegação em curso: o `beforeLoad` da rota privada já redireciona. Página pública não precisa de login.
    if (router.state.status === "pending" || !isPrivatePath(here.pathname)) return;
  }
  void router.navigate({ to: "/login", search: { redirect: safeRedirect(here.href) } });
}

setUnauthorizedHandler(handleSessionExpired);
