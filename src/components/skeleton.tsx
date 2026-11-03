/** Barra de carregamento com brilho. O brilho para sob `prefers-reduced-motion: reduce` (veja `index.css`). */
export function SkeletonBar({ className = "w-20" }: { className?: string }) {
  return <span aria-hidden="true" data-testid="skeleton-bar" className={`skeleton inline-block h-4 rounded ${className}`} />;
}
