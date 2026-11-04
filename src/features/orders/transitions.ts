import type { OrderStatus } from "@/shared/domain/contracts";

/** Pedidos confirmados ou recusados são terminais — versão maior não autoriza regressão. */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return from === "pending" && (to === "confirmed" || to === "declined");
}
