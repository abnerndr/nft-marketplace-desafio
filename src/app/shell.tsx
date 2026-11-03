import type { ReactNode } from "react";
import { useCartCount } from "@/features/cart/api";
import { PriceNotices } from "@/features/realtime/price-notice";
import { useRealtime } from "@/features/realtime/use-realtime";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppShell({ children }: { children: ReactNode }) {
  const cartCount = useCartCount();
  useRealtime();
  return (
    <div className="flex min-h-screen flex-col bg-ink text-foreground">
      <SiteHeader cartCount={cartCount} />
      <PriceNotices />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-5">{children}</main>
      <SiteFooter />
    </div>
  );
}
