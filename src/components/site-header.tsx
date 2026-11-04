import { Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import activeUnderline from "@/assets/header/active-underline.svg";
import badge from "@/assets/header/badge.svg";
import cartIcon from "@/assets/header/cart.svg";
import divider from "@/assets/header/divider.svg";
import loginIcon from "@/assets/header/login.svg";
import searchIcon from "@/assets/header/search.svg";
import filterIcon from "@/assets/home/filter.svg";
import { useLogout, useSession } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SiteHeaderProps = {
  cartCount?: number;
  /** Busca “Explorar coleções” + filtro na mesma linha (frame mobile). */
  compact?: boolean;
  onOpenFilters?: () => void;
  filtersOpen?: boolean;
};

const navLinkClass =
  "text-base font-normal text-foreground transition-colors hover:text-text-accent whitespace-nowrap";

function isMarketPath(pathname: string): boolean {
  return (
    pathname.startsWith("/nfts") ||
    pathname === "/cart" ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders")
  );
}

function isAccountPath(pathname: string): boolean {
  return pathname.startsWith("/account") || pathname === "/login" || pathname === "/register";
}

/** Com sessão: nome da conta e saída. Sem sessão: o botão Entrar do Figma. */
function AccountControl({ tabIndex }: { tabIndex?: number }) {
  const session = useSession();
  const signOut = useLogout();
  const navigate = useNavigate();
  const user = session.data;

  if (session.isPending) {
    return <div className="h-[35px] w-[100px]" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <Link
        to="/login"
        tabIndex={tabIndex}
        className="inline-flex h-[35px] w-[100px] items-center justify-center gap-1 rounded-md bg-primary text-base font-medium text-ink transition-colors hover:bg-text-accent"
      >
        <span className="flex size-5 items-center justify-center">
          <img src={loginIcon} alt="" width={18} height={17} className="max-w-none" />
        </span>
        Entrar
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        to="/account/profile"
        tabIndex={tabIndex}
        className="max-w-[140px] truncate text-base font-medium text-foreground hover:text-text-accent"
      >
        {user.name}
      </Link>
      <Button
        type="button"
        variant="accent"
        size="sm"
        tabIndex={tabIndex}
        aria-label="Encerrar sessão"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate(undefined, { onSettled: () => void navigate({ to: "/" }) })}
      >
        Sair
      </Button>
    </div>
  );
}

export function SiteHeader({ cartCount = 0, compact = false, onOpenFilters, filtersOpen = false }: SiteHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const hash = location.hash;
  const { q } = useSearch({ strict: false }) as { q?: string };
  const marketActive = isMarketPath(pathname) || hash === "catalogo";
  const homeActive =
    (pathname === "/" && hash !== "catalogo") || (isAccountPath(pathname) && !isMarketPath(pathname));
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  function handleSearchKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape" && searchOpen) {
      setSearchOpen(false);
      toggleRef.current?.focus();
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    void navigate({
      to: "/",
      hash: "catalogo",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        q: value === "" ? undefined : value,
        page: undefined,
      }),
    });
  }

  if (compact) {
    return (
      <header className="w-full pt-10">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3">
          <form
            role="search"
            onSubmit={handleSearch}
            className="flex w-full items-stretch gap-2"
          >
            <label className="flex h-[45px] min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-surface-card px-3">
              <img src={searchIcon} alt="" width={22} height={22} />
              <Input
                key={q ?? ""}
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Explorar coleções"
                aria-label="Explorar coleções"
                className="h-auto border-0 bg-transparent px-0 text-sm font-bold text-kurio-secondary placeholder:text-kurio-secondary focus-visible:outline-none"
              />
            </label>
            <Button
              type="button"
              aria-label="Filtros"
              aria-expanded={filtersOpen}
              aria-controls="catalogo-filtros-mobile"
              className="size-[45px] shrink-0 rounded-[14px] bg-gradient-to-br from-primary/45 to-primary p-0"
              onClick={onOpenFilters}
            >
              <img src={filterIcon} alt="" width={22} height={22} />
            </Button>
          </form>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full pt-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-start justify-between gap-x-10 gap-y-4 px-5 sm:px-6 lg:flex-nowrap lg:px-0">
        <Link to="/" className="py-2 text-sm font-bold tracking-[0.1em] text-foreground transition-colors hover:text-text-accent">
          KURIO
        </Link>

        <nav
          aria-label="Principal"
          className="order-last flex w-full items-start gap-10 overflow-x-auto pb-1 lg:order-none lg:w-auto lg:overflow-visible lg:pb-0"
        >
          <Link
            to="/"
            aria-current={homeActive && !marketActive ? "page" : undefined}
            className={
              homeActive && !marketActive
                ? "flex flex-col gap-6 text-base font-bold text-text-accent"
                : navLinkClass
            }
          >
            Início
            {homeActive && !marketActive ? (
              <img src={activeUnderline} alt="" width={58} height={3} className="block max-w-none" />
            ) : null}
          </Link>
          <Link
            to="/"
            hash="catalogo"
            aria-current={marketActive ? "page" : undefined}
            className={
              marketActive ? "flex flex-col gap-6 text-base font-bold text-text-accent" : navLinkClass
            }
          >
            Mercado
            {marketActive ? (
              <img src={activeUnderline} alt="" width={58} height={3} className="block max-w-none" />
            ) : null}
          </Link>
          <Link to="/" hash="diario" className={navLinkClass}>
            Criadores
          </Link>
          <Link to="/" hash="diario" className={navLinkClass}>
            Aprenda
          </Link>
        </nav>

        <div className="flex min-h-[35px] shrink-0 items-center gap-5 sm:gap-7">
          <form
            role="search"
            onSubmit={handleSearch}
            onKeyDown={handleSearchKeyDown}
            className="flex items-center gap-2"
          >
            {searchOpen ? (
              <Input
                ref={inputRef}
                key={q ?? ""}
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar NFTs"
                aria-label="Buscar NFTs"
                className="h-8 w-28 rounded-none border-0 border-b border-border-soft px-0 sm:w-40"
              />
            ) : null}
            <Button
              ref={toggleRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Abrir busca"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
              className="shrink-0"
            >
              <img src={searchIcon} alt="" width={20} height={20} />
            </Button>
          </form>

          <Link to="/cart" aria-label="Carrinho" className="relative block">
            <img src={cartIcon} alt="" width={24} height={24} />
            {cartCount > 0 ? (
              <span className="absolute top-0 left-[15px] flex size-4 items-center justify-center">
                <img src={badge} alt="" width={20} height={20} className="absolute max-w-none" />
                <span className="relative text-[10px] font-medium text-ink">{cartCount}</span>
              </span>
            ) : null}
          </Link>

          <AccountControl />
        </div>
      </div>
      {!marketActive ? (
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-6 lg:px-0">
          <img src={divider} alt="" width={1200} height={0.3} className="block h-px w-full max-w-none" />
        </div>
      ) : null}
    </header>
  );
}
