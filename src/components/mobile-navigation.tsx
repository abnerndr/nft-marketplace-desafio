import { Link, useLocation } from "@tanstack/react-router";
import { Heart, Home, ScanLine, ShoppingBag, UserRound } from "lucide-react";
import { useCartCount } from "@/features/cart/api";
import { useSession } from "@/features/auth/session";
import { cn } from "@/lib/utils";

/** Bottom nav do frame mobile; só os alvos são clicáveis — o restante não intercepta a página. */
export function MobileNavigation() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const cartCount = useCartCount();
  const session = useSession();
  const accountTo = session.data ? "/account/profile" : "/login";

  const homeActive = pathname === "/";
  const cartActive =
    pathname === "/cart" || pathname.startsWith("/checkout") || pathname.startsWith("/orders");
  const accountActive = pathname.startsWith("/account") || pathname === "/login" || pathname === "/register";

  const itemClass = (active: boolean) =>
    cn(
      "pointer-events-auto flex size-11 items-center justify-center rounded-full",
      active ? "text-text-accent" : "text-foreground/80",
    );

  return (
    <nav
      aria-label="Navegação mobile"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden"
    >
      <div className="relative mx-auto h-[72px] max-w-[480px] px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[58px] rounded-t-[28px] bg-surface-card/95 shadow-[0_-8px_24px_rgba(10,6,4,0.45)] backdrop-blur-sm"
        />
        <div className="relative flex h-full w-full items-center justify-between gap-1">
          <Link
            to="/"
            aria-label="Início"
            aria-current={homeActive ? "page" : undefined}
            className={itemClass(homeActive)}
          >
            <Home className="size-5" strokeWidth={homeActive ? 2.4 : 1.8} />
          </Link>

          <Link
            to="/"
            hash="catalogo"
            aria-label="Favoritos (use o coração nos cards do catálogo)"
            className={itemClass(false)}
          >
            <Heart className="size-5" strokeWidth={1.8} />
          </Link>

          <Link
            to="/"
            hash="catalogo"
            aria-label="Explorar catálogo"
            className="pointer-events-auto relative -mt-8 flex size-[65px] items-center justify-center rounded-full bg-primary text-ink shadow-[0_8px_20px_rgba(210,138,76,0.45)]"
          >
            <ScanLine className="size-7" strokeWidth={2.2} />
          </Link>

          <Link
            to="/cart"
            aria-label="Carrinho"
            aria-current={cartActive ? "page" : undefined}
            className={cn(itemClass(cartActive), "relative")}
          >
            <ShoppingBag className="size-5" strokeWidth={cartActive ? 2.4 : 1.8} />
            {cartCount > 0 ? (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-ink">
                {cartCount}
              </span>
            ) : null}
          </Link>

          <Link
            to={accountTo}
            aria-label="Conta"
            aria-current={accountActive ? "page" : undefined}
            className={itemClass(accountActive)}
          >
            <UserRound className="size-5" strokeWidth={accountActive ? 2.4 : 1.8} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
