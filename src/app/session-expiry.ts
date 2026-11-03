import { router } from "@/app/router";
import { clearSessionToken, isPrivatePath, safeRedirect, sessionQueryKey } from "@/features/auth/session";
import { setUnauthorizedHandler, type UnauthorizedInfo } from "@/shared/api/client";
import { queryClient } from "@/shared/api/query-client";

/**
 * Sessão vencida no meio da navegação ou do checkout: apaga só o token, avisa o cache e manda para
 * `/login?redirect=<onde estava>`. Não mexe no carrinho de visitante nem no rascunho do checkout
 * (a tentativa de pedido guardada), para o usuário voltar e seguir de onde parou.
 */
export function handleSessionExpired({ url }: UnauthorizedInfo): void {
  clearSessionToken();
  queryClient.setQueryData(sessionQueryKey, null);

  const here = router.history.location;
  if (here.pathname === "/login" || here.pathname === "/register") return;
  if (url.split("?")[0] === "/auth/session") {
    // Navegação em curso: o `beforeLoad` da rota privada já redireciona. Página pública não precisa de login.
    if (router.state.status === "pending" || !isPrivatePath(here.pathname)) return;
  }
  void router.navigate({ to: "/login", search: { redirect: safeRedirect(here.href) } });
}

setUnauthorizedHandler(handleSessionExpired);
