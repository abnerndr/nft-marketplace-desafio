import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import {
  catalogSearchSchema,
  parseSearchString,
  stringifySearch,
} from "@/features/catalog/search";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { safeRedirect } from "@/features/auth/session";
import { RootLayout } from "@/routes/__root";
import { CartRoute } from "@/routes/cart";
import { NftRoute } from "@/routes/nft";
import { HomeRoute } from "@/routes/index";

export type AuthSearch = {
  redirect?: string;
};

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeRoute,
  validateSearch: (search: Record<string, unknown>) => catalogSearchSchema.parse(search),
});

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cart",
  component: CartRoute,
});

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nfts/$slug",
  component: NftRoute,
});

function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  return { redirect: safeRedirect(search.redirect) };
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
  validateSearch: validateAuthSearch,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
  validateSearch: validateAuthSearch,
});

const routeTree = rootRoute.addChildren([indexRoute, nftRoute, cartRoute, loginRoute, registerRoute]);

// Search sem JSON: listas viram parâmetros repetidos (?collection=a&collection=b).
export const router = createRouter({
  routeTree,
  parseSearch: parseSearchString,
  stringifySearch,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
