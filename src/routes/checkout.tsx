import { lazy } from "react";
import { LazyRoute } from "@/app/lazy-route";

const PaymentPage = lazy(() =>
  import("@/features/checkout/payment-page").then((mod) => ({ default: mod.PaymentPage })),
);

export function CheckoutRoute() {
  return (
    <LazyRoute>
      <PaymentPage />
    </LazyRoute>
  );
}
