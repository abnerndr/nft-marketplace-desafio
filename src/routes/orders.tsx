import { useParams } from "@tanstack/react-router";
import { ConfirmationPage } from "@/features/orders/confirmation-page";

export function OrderRoute() {
  const { orderId } = useParams({ strict: false }) as { orderId: string };
  return <ConfirmationPage orderId={orderId} />;
}
