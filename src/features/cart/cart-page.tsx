import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import deleteIcon from "@/assets/cart/delete.svg";
import deleteMobile from "@/assets/cart/delete-mobile.svg";
import lineSummary from "@/assets/cart/line-summary.svg";
import lineTable from "@/assets/cart/line-table.svg";
import minus from "@/assets/cart/minus.svg";
import minusActiveMobile from "@/assets/cart/minus-active-mobile.svg";
import minusDisabledMobile from "@/assets/cart/minus-disabled-mobile.svg";
import plus from "@/assets/cart/plus.svg";
import lineSection from "@/assets/nft/line-section.svg";
import { MobileScreenHeader } from "@/components/mobile-screen-header";
import { nftListQuery } from "@/features/catalog/api";
import { NftCard } from "@/features/catalog/nft-card";
import { toParams } from "@/features/catalog/search";
import { readApiError } from "@/shared/api/errors";
import type { CartLine } from "@/shared/domain/contracts";
import { formatEth, mulEth } from "@/shared/domain/money";
import { useCart, useCartActions, useCouponActions } from "./api";
import { SkeletonBar } from "@/components/skeleton";
import { useQuote } from "./quote";

const RELATED_COUNT = 5;

type RowProps = {
  line: CartLine;
  busy: boolean;
  onQuantity: (line: CartLine, quantity: number) => void;
  onRemove: (line: CartLine) => void;
};

const pillButton =
  "flex h-[30px] w-5 shrink-0 items-center justify-center rounded-[20px] border border-ink bg-primary shadow-[0_4px_6px_rgba(20,13,10,0.15)] transition-opacity disabled:opacity-40";

function DesktopStepper({ line, busy, onQuantity }: Omit<RowProps, "onRemove">) {
  return (
    <div className="flex w-[75px] items-center justify-between">
      <button
        type="button"
        aria-label={`Diminuir quantidade de ${line.title}`}
        disabled={busy || line.quantity <= 1}
        onClick={() => onQuantity(line, line.quantity - 1)}
        className={pillButton}
      >
        <img src={minus} alt="" />
      </button>
      <span aria-live="polite" className="text-[17px] leading-6 text-foreground">
        {line.quantity}
      </span>
      <button
        type="button"
        aria-label={`Aumentar quantidade de ${line.title}`}
        disabled={busy || line.quantity >= line.available}
        onClick={() => onQuantity(line, line.quantity + 1)}
        className={pillButton}
      >
        <img src={plus} alt="" />
      </button>
    </div>
  );
}

function MobileStepper({ line, busy, onQuantity }: Omit<RowProps, "onRemove">) {
  const atMin = line.quantity <= 1;
  const atMax = line.quantity >= line.available;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={`Diminuir quantidade de ${line.title}`}
        disabled={busy || atMin}
        onClick={() => onQuantity(line, line.quantity - 1)}
        className="size-6 shrink-0"
      >
        <img src={atMin ? minusDisabledMobile : minusActiveMobile} alt="" />
      </button>
      <span aria-live="polite" className="min-w-3 text-center text-base leading-[22px] text-foreground">
        {line.quantity}
      </span>
      <button
        type="button"
        aria-label={`Aumentar quantidade de ${line.title}`}
        disabled={busy || atMax}
        onClick={() => onQuantity(line, line.quantity + 1)}
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-[#2F1D15] text-[21px] leading-4 text-foreground disabled:opacity-40"
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

function DesktopRow(props: RowProps) {
  const { line, busy, onRemove } = props;
  return (
    <li className="hidden h-[70px] items-center justify-between bg-surface-card pr-6 lg:flex">
      <div className="flex h-full w-[250px] items-center gap-4">
        <img
          src={line.imageUrl}
          alt={line.title}
          width={70}
          height={70}
          className="size-[70px] shrink-0 rounded-md object-cover"
        />
        <div className="flex w-[180px] shrink-0 flex-col gap-0.5 leading-4">
          <Link
            to="/nfts/$slug"
            params={{ slug: line.slug }}
            className="truncate text-base font-bold text-foreground"
          >
            {line.title}
          </Link>
          <p className="truncate text-sm text-kurio-secondary">ID do token: {line.tokenId}</p>
          <p className="truncate text-sm text-kurio-secondary">Edição: {line.editionLabel}</p>
        </div>
      </div>
      <p className="w-[77px] whitespace-nowrap text-base font-bold leading-4 text-text-secondary">{formatEth(line.priceEth)}</p>
      <DesktopStepper {...props} />
      <p className="w-[87px] text-base font-bold leading-4 text-text-accent">
        {formatEth(mulEth(line.priceEth, line.quantity))}
      </p>
      <button
        type="button"
        aria-label={`Remover ${line.title} do carrinho`}
        disabled={busy}
        onClick={() => onRemove(line)}
        className="flex size-6 items-center justify-center disabled:opacity-40"
      >
        <img src={deleteIcon} alt="" />
      </button>
    </li>
  );
}

function MobileRow(props: RowProps) {
  const { line, busy, onRemove } = props;
  return (
    <li className="relative flex h-[100px] overflow-hidden rounded-[14px] bg-surface-card shadow-[0_6px_20px_rgba(10,6,4,0.45)] lg:hidden">
      <img
        src={line.imageUrl}
        alt={line.title}
        width={100}
        height={100}
        className="size-[100px] shrink-0 rounded-l-[14px] object-cover"
      />
      <div className="relative flex-1 pl-2.5 pr-3 pt-[13px]">
        <Link
          to="/nfts/$slug"
          params={{ slug: line.slug }}
          className="block truncate pr-8 text-[15px] font-bold leading-4 text-foreground"
        >
          {line.title}
        </Link>
        <p className="mt-1.5 text-sm leading-4 text-text-secondary">Edição: {line.editionLabel}</p>
        <p className="absolute bottom-[15px] left-2.5 text-lg font-bold leading-4 text-text-accent">
          {formatEth(mulEth(line.priceEth, line.quantity))}
        </p>
        <div className="absolute bottom-[14px] right-3">
          <MobileStepper {...props} />
        </div>
        <button
          type="button"
          aria-label={`Remover ${line.title} do carrinho`}
          disabled={busy}
          onClick={() => onRemove(line)}
          className="absolute right-3 top-2.5 flex size-6 items-center justify-center disabled:opacity-40"
        >
          <img src={deleteMobile} alt="" />
        </button>
      </div>
    </li>
  );
}

function TableHeader() {
  return (
    <div className="hidden flex-col gap-3 lg:flex">
      <div className="flex items-center justify-between pr-6 text-base leading-4 text-foreground">
        <p className="w-[250px] font-bold">NFTs</p>
        <p className="w-[77px] font-medium">Preço</p>
        <p className="w-[75px] font-bold">Edições</p>
        <p className="w-[87px] font-medium">Total</p>
        <span className="w-6" aria-hidden="true" />
      </div>
      <img src={lineTable} alt="" aria-hidden="true" className="h-[0.3px] w-full" />
    </div>
  );
}

/** `value` nulo é "ainda carregando": mostra o esqueleto, nunca um traço. */
function Row({ label, value, className = "" }: { label: string; value: string | null; className?: string }) {
  return (
    <div className={`flex items-start justify-between ${className}`}>
      <span>{label}</span>
      <span className="text-right">{value ?? <SkeletonBar />}</span>
    </div>
  );
}

function Summary({ lines, isGuest, couponCode }: { lines: CartLine[]; isGuest: boolean; couponCode: string | null }) {
  const [draft, setDraft] = useState("");
  const quote = useQuote(lines, couponCode);
  const { apply, clear } = useCouponActions(isGuest, lines);
  const couponError = apply.isError
    ? (readApiError(apply.error).fields?.couponCode ?? readApiError(apply.error).message)
    : null;
  const totals = quote.data;
  // Sem total: carregando mostra o esqueleto; só a falha cai no traço (o erro aparece acima).
  const pending = quote.isError ? "—" : null;

  function submitCoupon(event: FormEvent) {
    event.preventDefault();
    const code = draft.trim();
    if (code === "") return;
    clear.reset();
    apply.mutate(code, { onSuccess: () => setDraft("") });
  }

  return (
    <aside
      aria-labelledby="cart-summary-title"
      aria-busy={quote.isPending}
      className="flex flex-col gap-6 max-lg:-mx-5 max-lg:rounded-t-[40px] max-lg:bg-surface-card max-lg:px-6 max-lg:pb-9 max-lg:pt-6 lg:w-[332px] lg:shrink-0"
    >
      <div className="hidden flex-col gap-3 lg:flex">
        <h2 id="cart-summary-title" className="text-lg font-bold leading-4 text-foreground">
          Resumo da carteira
        </h2>
        <img src={lineSummary} alt="" aria-hidden="true" className="h-[0.3px] w-full" />
      </div>
      <h2 className="sr-only lg:hidden">Resumo da carteira</h2>

      <form onSubmit={submitCoupon} className="flex flex-col gap-2">
        <label htmlFor="cart-coupon" className="hidden text-sm font-bold leading-4 text-foreground lg:block">
          Código promocional
        </label>
        <div className="flex h-[50px] items-center rounded-[40px] border border-border bg-surface-card pl-4 lg:h-10 lg:rounded-[3px] lg:border-primary lg:bg-transparent lg:pl-2">
          <input
            id="cart-coupon"
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (apply.isError) apply.reset();
            }}
            aria-invalid={couponError !== null}
            aria-describedby={couponError ? "cart-coupon-error" : undefined}
            placeholder="Digite o código promocional..."
            className="min-w-0 flex-1 bg-transparent text-[13px] leading-[22px] text-foreground placeholder:text-kurio-secondary lg:text-xs lg:leading-4"
          />
          <button
            type="submit"
            disabled={apply.isPending || draft.trim() === ""}
            className="h-[50px] w-[97px] shrink-0 rounded-[40px] bg-gradient-to-r from-primary/55 to-primary text-[15px] font-bold leading-4 text-foreground disabled:cursor-not-allowed disabled:opacity-60 lg:h-10 lg:w-[102px] lg:rounded-none lg:rounded-r-[3px] lg:bg-primary lg:bg-none lg:text-ink lg:disabled:opacity-100"
          >
            Aplicar
          </button>
        </div>
        {couponError ? (
          <p id="cart-coupon-error" role="alert" className="text-xs leading-4 text-text-coral">
            {couponError}
          </p>
        ) : null}
        {couponCode ? (
          <div className="flex items-center justify-between text-xs leading-4 text-text-accent">
            <p>Cupom {couponCode} aplicado.</p>
            <button
              type="button"
              disabled={clear.isPending}
              onClick={() => {
                apply.reset();
                clear.mutate();
              }}
              className="underline disabled:opacity-60"
            >
              Remover cupom
            </button>
          </div>
        ) : null}
        {clear.isError ? (
          <p role="alert" className="text-xs leading-4 text-text-coral">
            {readApiError(clear.error).message}
          </p>
        ) : null}
      </form>

      {quote.isError && !totals ? (
        <p role="alert" className="text-sm text-text-coral">
          {readApiError(quote.error).message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 text-[15px] leading-4 text-foreground">
        <Row label="Subtotal" value={totals ? formatEth(totals.subtotalEth) : pending} className="[&_span:last-child]:text-base lg:[&_span:last-child]:text-lg" />
        <Row label="Desconto do lançamento" value={totals ? `(-) ${formatEth(totals.discountEth)}` : pending} />
        <div className="flex flex-col items-end lg:gap-3">
          <Row label="Taxa de rede" value={totals ? formatEth(totals.networkFeeEth) : pending} className="w-full [&_span:last-child]:text-base lg:[&_span:last-child]:text-lg" />
          <p className="text-xs leading-4 text-text-accent">Taxa estimada</p>
        </div>
        <div className="flex items-start justify-between font-bold lg:mt-3">
          <span className="text-base">Total</span>
          <span className="text-lg text-text-accent">{totals ? formatEth(totals.totalEth) : (pending ?? <SkeletonBar />)}</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        {isGuest ? (
          <Link
            to="/login"
            search={{ redirect: "/cart" }}
            className="flex h-[60px] w-full items-center justify-center rounded-[40px] bg-gradient-to-br from-primary to-primary/80 text-base font-bold leading-4 text-ink lg:h-10 lg:rounded-[3px] lg:bg-primary lg:bg-none lg:text-[15px]"
          >
            Conectar e finalizar
          </Link>
        ) : (
          <Link
            to="/checkout"
            className="flex h-[60px] w-full items-center justify-center rounded-[40px] bg-gradient-to-br from-primary to-primary/80 text-base font-bold leading-4 text-ink lg:h-10 lg:rounded-[3px] lg:bg-primary lg:bg-none lg:text-[15px]"
          >
            Conectar e finalizar
          </Link>
        )}
        <Link to="/" hash="catalogo" className="hidden text-[15px] text-text-accent lg:block">
          Continuar explorando
        </Link>
      </div>
    </aside>
  );
}

function RelatedNfts({ exclude }: { exclude: Set<string> }) {
  const related = useQuery(nftListQuery({ ...toParams({}), pageSize: RELATED_COUNT + exclude.size + 1 }));
  const items = (related.data?.items ?? []).filter((item) => !exclude.has(item.slug)).slice(0, RELATED_COUNT);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="cart-related-title" className="flex flex-col gap-8 pb-12">
      <div className="flex flex-col gap-3">
        <h2 id="cart-related-title" className="text-[17px] font-bold leading-4 text-text-accent">
          Colecionadores também viram
        </h2>
        <img src={lineSection} alt="" aria-hidden="true" className="h-[0.3px] w-full" />
      </div>
      <ul className="flex gap-6 overflow-x-auto pb-2 lg:justify-between">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <NftCard nft={item} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CartSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando carrinho"
      className="flex flex-col gap-3 lg:w-[782px]"
    >
      {[0, 1, 2].map((index) => (
        <div key={index} className="skeleton h-[100px] rounded-[14px] lg:h-[70px] lg:rounded-none" />
      ))}
    </div>
  );
}

function EmptyCart() {
  return (
    <section className="flex flex-col items-start gap-4 py-12">
      <h2 className="text-xl font-bold text-foreground">Seu carrinho está vazio</h2>
      <p className="text-sm text-text-secondary">Escolha um NFT no catálogo para começar.</p>
      <Link
        to="/"
        hash="catalogo"
        className="flex h-10 items-center rounded-[3px] bg-primary px-6 text-[15px] font-bold text-ink"
      >
        Continuar explorando
      </Link>
    </section>
  );
}

export function CartPage() {
  const cart = useCart();
  const { setQuantity, remove } = useCartActions(cart.isGuest);
  const busy = setQuantity.isPending || remove.isPending;

  const actionError = setQuantity.error ?? remove.error;
  const inCart = new Set(cart.lines.map((line) => line.slug));

  function changeQuantity(line: CartLine, quantity: number) {
    remove.reset();
    setQuantity.mutate({ line, quantity });
  }

  function removeLine(line: CartLine) {
    setQuantity.reset();
    remove.mutate(line);
  }

  return (
    <div className="flex flex-col gap-12 pt-4 lg:gap-24 lg:pt-6">
      <div className="flex flex-col gap-3">
        <nav aria-label="Navegação estrutural" className="hidden lg:block">
          <p className="text-[15px] font-bold leading-4 text-foreground">
            <Link to="/">Início</Link> /{" "}
            <Link to="/" hash="catalogo">
              Mercado
            </Link>{" "}
            / Carrinho
          </p>
        </nav>

        <MobileScreenHeader title="Carrinho de NFTs" backTo="/" backAriaLabel="Voltar ao catálogo" />
        <h1 className="sr-only max-lg:hidden">Carrinho de NFTs</h1>

        {cart.isPending ? (
          <CartSkeleton />
        ) : cart.isError ? (
          <section role="alert" className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-text-coral">{readApiError(cart.error).message}</p>
            <button
              type="button"
              onClick={cart.refetch}
              className="h-10 rounded-[3px] border border-primary px-4 text-sm font-medium text-text-accent"
            >
              Tentar novamente
            </button>
          </section>
        ) : cart.lines.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3 lg:w-[782px]">
              {actionError ? (
                <p role="alert" className="text-sm text-text-coral">
                  {readApiError(actionError).message}
                </p>
              ) : null}
              <TableHeader />
              <ul aria-label="Itens do carrinho" className="flex flex-col gap-5 lg:gap-3">
                {cart.lines.map((line) => (
                  <RowPair
                    key={line.id}
                    line={line}
                    busy={busy}
                    onQuantity={changeQuantity}
                    onRemove={removeLine}
                  />
                ))}
              </ul>
            </div>
            <Summary lines={cart.lines} isGuest={cart.isGuest} couponCode={cart.couponCode} />
          </div>
        )}
      </div>

      <RelatedNfts exclude={inCart} />
    </div>
  );
}

function RowPair(props: RowProps) {
  return (
    <>
      <DesktopRow {...props} />
      <MobileRow {...props} />
    </>
  );
}
