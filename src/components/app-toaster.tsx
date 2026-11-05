import { dismissToast, useToasts } from "@/shared/ui/toast";

/** Toasts flutuantes no visual da Kurio (surface-card + borda accent). */
export function AppToaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:right-4 lg:items-end"
      role="status"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex w-full max-w-[360px] items-center justify-between gap-4 rounded-lg border border-text-accent/40 bg-surface-card px-4 py-3 text-sm text-foreground shadow-[0_8px_24px_rgba(10,6,4,0.45)]"
        >
          <p className="min-w-0 flex-1 leading-5">{toast.message}</p>
          <button
            type="button"
            aria-label="Fechar aviso"
            className="shrink-0 text-text-accent underline underline-offset-4"
            onClick={() => dismissToast(toast.id)}
          >
            Ok
          </button>
        </div>
      ))}
    </div>
  );
}
