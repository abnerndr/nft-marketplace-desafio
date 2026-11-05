import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { useCartCount } from "@/features/cart/api";
import { PriceNotices } from "@/features/realtime/price-notice";
import { ScenarioPanel } from "@/features/realtime/scenario-panel";
import { useRealtime } from "@/features/realtime/use-realtime";
import { AppToaster } from "@/components/app-toaster";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HomePage } from "@/features/catalog/home-page";

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}

export function AppShell({ children }: { children: ReactNode }) {
  const cartCount = useCartCount();
  const pathname = useLocation({ select: (location) => location.pathname });
  useRealtime();

  const auth = isAuthRoute(pathname);
  /** Bottom nav Figma só no Início (frames de detalhe/carrinho/pagamento não têm tab bar). */
  const showMobileNav = pathname === "/";
  const mainClassName = auth
    ? "mx-auto w-full max-w-[1200px] flex-1 px-7 sm:px-6 lg:px-0"
    : showMobileNav
      ? "mx-auto w-full max-w-[1200px] flex-1 px-6 sm:px-6 pb-[calc(126px+env(safe-area-inset-bottom))] lg:px-0 lg:pb-8"
      : "mx-auto w-full max-w-[1200px] flex-1 px-6 sm:px-6 lg:px-0 lg:pb-8";

  return (
    <div className="flex min-h-screen flex-col bg-ink text-foreground">
      {/* Desktop sempre; mobile omite o chrome em auth (página própria do frame). */}
      <div className={auth ? "hidden lg:block" : "contents"}>
        <div className="hidden lg:block">
          <SiteHeader cartCount={cartCount} />
        </div>
      </div>
      <PriceNotices />
      {auth ? (
        <div className="mx-auto hidden w-full max-w-[1200px] lg:block" aria-hidden="true" inert>
          <HomePage />
        </div>
      ) : null}
      <main className={mainClassName}>
        {children}
      </main>
      {!pathname.startsWith("/account/") ? (
        <div className="hidden lg:block">
          <SiteFooter />
        </div>
      ) : null}
      {showMobileNav ? <MobileNavigation /> : null}
      <AppToaster />
      <ScenarioPanel />
    </div>
  );
}
