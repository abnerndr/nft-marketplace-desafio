import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { useCartCount } from "@/features/cart/api";
import { PriceNotices } from "@/features/realtime/price-notice";
import { ScenarioPanel } from "@/features/realtime/scenario-panel";
import { useRealtime } from "@/features/realtime/use-realtime";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}

export function AppShell({ children }: { children: ReactNode }) {
  const cartCount = useCartCount();
  const pathname = useLocation({ select: (location) => location.pathname });
  useRealtime();

  const auth = isAuthRoute(pathname);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-foreground">
      {/* Desktop sempre; mobile omite o chrome em auth (página própria do frame). */}
      <div className={auth ? "hidden lg:block" : "contents"}>
        <div className="hidden lg:block">
          <SiteHeader cartCount={cartCount} />
        </div>
        {!auth ? (
          <div className="lg:hidden">
            <SiteHeader cartCount={cartCount} compact />
          </div>
        ) : null}
      </div>
      <PriceNotices />
      <main
        className={
          auth
            ? "mx-auto w-full max-w-[1200px] flex-1 px-6"
            : "mx-auto w-full max-w-[1200px] flex-1 px-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8"
        }
      >
        {children}
      </main>
      <div className="hidden lg:block">
        <SiteFooter />
      </div>
      {!auth ? <MobileNavigation /> : null}
      <ScenarioPanel />
    </div>
  );
}
