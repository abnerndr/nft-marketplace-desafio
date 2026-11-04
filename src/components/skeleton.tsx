import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Barra de carregamento com brilho. O brilho para sob `prefers-reduced-motion: reduce`. */
export function SkeletonBar({ className = "w-20" }: { className?: string }) {
  return <Skeleton data-testid="skeleton-bar" className={cn("inline-block h-4", className)} />;
}
