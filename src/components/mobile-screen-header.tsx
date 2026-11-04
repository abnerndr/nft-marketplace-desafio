import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import backArrow from "@/assets/cart/back-arrow.svg";
import backCircle from "@/assets/cart/back-circle.svg";

type MobileScreenHeaderProps = {
  title?: string;
  backTo?: string;
  backAriaLabel?: string;
  onBack?: () => void;
  trailing?: ReactNode;
};

export function MobileScreenHeader({
  title,
  backTo,
  backAriaLabel = "Voltar",
  onBack,
  trailing,
}: MobileScreenHeaderProps) {
  const router = useRouter();

  const backClass =
    "relative flex size-[35px] shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-primary";
  const backInner = (
    <>
      <img src={backCircle} alt="" className="absolute inset-0 size-[35px]" />
      <img src={backArrow} alt="" className="relative rotate-90" />
    </>
  );

  return (
    <header className="relative flex h-11 w-full items-center lg:hidden">
      {backTo ? (
        <Link to={backTo} aria-label={backAriaLabel} className={backClass}>
          {backInner}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={backAriaLabel}
          className={backClass}
          onClick={() => (onBack ? onBack() : router.history.back())}
        >
          {backInner}
        </button>
      )}
      {title ? (
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-xl font-bold leading-4 text-foreground">
          {title}
        </h1>
      ) : null}
      <div className="ml-auto flex size-[35px] shrink-0 items-center justify-center">{trailing ?? null}</div>
    </header>
  );
}
