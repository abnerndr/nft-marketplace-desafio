import { Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import activeUnderline from "@/assets/header/active-underline.svg";
import badge from "@/assets/header/badge.svg";
import cartIcon from "@/assets/header/cart.svg";
import divider from "@/assets/header/divider.svg";
import loginIcon from "@/assets/header/login.svg";
import searchIcon from "@/assets/header/search.svg";
import { useLogout, useSession } from "@/features/auth/session";

type SiteHeaderProps = {
  cartCount?: number;
};

const navLinkClass =
  "text-base font-normal text-foreground transition-colors hover:text-text-accent whitespace-nowrap";

/** Com sessão: nome da conta e saída. Sem sessão: o botão Entrar do Figma. */
function AccountControl() {
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
        className="flex h-[35px] w-[100px] items-center justify-center gap-1 rounded-md bg-primary text-base font-medium text-ink"
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
        className="max-w-[140px] truncate text-base font-medium text-foreground hover:text-text-accent"
      >
        {user.name}
      </Link>
      <button
        type="button"
        aria-label="Encerrar sessão"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate(undefined, { onSettled: () => void navigate({ to: "/" }) })}
        className="text-sm font-medium text-text-accent disabled:opacity-60"
      >
        Sair
      </button>
    </div>
  );
}

export function SiteHeader({ cartCount = 0 }: SiteHeaderProps) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { q } = useSearch({ strict: false }) as { q?: string };
  const homeActive = pathname === "/";
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

  return (
    <header className="w-full">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-start justify-between gap-x-10 gap-y-4 px-5">
        <Link
          to="/"
          className="py-2 text-sm font-bold tracking-[0.1em] text-foreground"
        >
          KURIO
        </Link>

        <nav
          aria-label="Principal"
          className="order-last flex w-full items-start gap-10 overflow-x-auto pb-1 lg:order-none lg:w-auto lg:overflow-visible lg:pb-0"
        >
          <Link
            to="/"
            aria-current={homeActive ? "page" : undefined}
            className={
              homeActive
                ? "flex flex-col gap-6 text-base font-bold text-text-accent"
                : navLinkClass
            }
          >
            Início
            {homeActive ? (
              <img
                src={activeUnderline}
                alt=""
                width={58}
                height={3}
                className="block max-w-none"
              />
            ) : null}
          </Link>
          <Link to="/" className={navLinkClass}>
            Mercado
          </Link>
          <Link to="/" hash="diario" className={navLinkClass}>
            Criadores
          </Link>
          <Link to="/" hash="diario" className={navLinkClass}>
            Aprenda
          </Link>
        </nav>

        <div className="flex min-h-[35px] items-center gap-5 sm:gap-7">
          <form
            role="search"
            onSubmit={handleSearch}
            onKeyDown={handleSearchKeyDown}
            className="flex items-center gap-2"
          >
            {searchOpen ? (
              <input
                ref={inputRef}
                key={q ?? ""}
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar NFTs"
                aria-label="Buscar NFTs"
                className="h-8 w-28 border-b border-border-soft bg-transparent text-sm text-foreground placeholder:text-kurio-secondary focus:border-primary focus:outline-none sm:w-40"
              />
            ) : null}
            <button
              ref={toggleRef}
              type="button"
              aria-label="Abrir busca"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
              className="shrink-0"
            >
              <img src={searchIcon} alt="" width={20} height={20} />
            </button>
          </form>

          <Link to="/cart" aria-label="Carrinho" className="relative block">
            <img src={cartIcon} alt="" width={24} height={24} />
            {cartCount > 0 ? (
              <span className="absolute left-[15px] top-0 flex size-4 items-center justify-center">
                <img
                  src={badge}
                  alt=""
                  width={20}
                  height={20}
                  className="absolute max-w-none"
                />
                <span className="relative text-[10px] font-medium text-ink">
                  {cartCount}
                </span>
              </span>
            ) : null}
          </Link>

          <AccountControl />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1240px] px-5">
        <img
          src={divider}
          alt=""
          width={1200}
          height={0.3}
          className="block h-px w-full max-w-none"
        />
      </div>
    </header>
  );
}
