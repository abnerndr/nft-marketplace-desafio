import { lazy } from "react";
import { useParams } from "@tanstack/react-router";
import { LazyRoute } from "@/app/lazy-route";

const ConfirmationPage = lazy(() =>
  import("@/features/orders/confirmation-page").then((mod) => ({
    default: mod.ConfirmationPage,
  })),
);

export function OrderRoute() {
  const { orderId } = useParams({ strict: false }) as { orderId: string };
  return (
    <LazyRoute>
      <ConfirmationPage orderId={orderId} />
    </LazyRoute>
  );
}
