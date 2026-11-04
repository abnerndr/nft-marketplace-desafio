import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary font-bold text-ink hover:bg-text-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-surface-dark",
        outline: "border border-border bg-transparent text-foreground hover:border-primary",
        ghost: "bg-transparent text-foreground hover:text-text-accent",
        accent: "bg-transparent font-bold text-text-accent hover:text-primary",
        link: "h-auto rounded-none p-0 font-bold text-text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-base",
        sm: "h-8 px-3 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});

export { buttonVariants };
