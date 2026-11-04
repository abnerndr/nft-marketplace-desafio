import { cn } from "@/lib/utils";

/** Shimmer do projeto (`index.css` `.skeleton`); respeita `prefers-reduced-motion`. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("skeleton rounded-md", className)} {...props} />;
}
