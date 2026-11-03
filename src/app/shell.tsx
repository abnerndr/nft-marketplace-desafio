import type { ReactNode } from "react";
import { useCartCount } from "@/features/cart/api";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppShell({ children }: { children: ReactNode }) {
  const cartCount = useCartCount();
  return (
    <div className="flex min-h-screen flex-col bg-ink text-foreground">
      <SiteHeader cartCount={cartCount} />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-5">{children}</main>
      <SiteFooter />
    </div>
  );
}
