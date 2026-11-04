import { lazy } from "react";
import { LazyRoute } from "@/app/lazy-route";

const CartPage = lazy(() =>
  import("@/features/cart/cart-page").then((mod) => ({ default: mod.CartPage })),
);

export function CartRoute() {
  return (
    <LazyRoute>
      <CartPage />
    </LazyRoute>
  );
}
