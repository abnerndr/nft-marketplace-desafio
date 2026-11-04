import { Suspense, type ReactNode } from "react";

function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Carregando página"
      className="flex min-h-[40vh] items-center justify-center"
    >
      <div className="skeleton h-8 w-40 rounded" />
    </div>
  );
}

/** Envolve uma tela carregada sob demanda (checkout, conta, pedidos, auth). */
export function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}
