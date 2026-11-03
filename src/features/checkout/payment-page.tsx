import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import backArrow from "@/assets/cart/back-arrow.svg";
import backCircle from "@/assets/cart/back-circle.svg";
import arrowDown from "@/assets/checkout/arrow-down.svg";
import kebab from "@/assets/checkout/kebab.svg";
import line from "@/assets/checkout/line-items.svg";
import lineTotals from "@/assets/checkout/line-totals.svg";
import providerCircle from "@/assets/checkout/provider-circle.svg";
import radioOff from "@/assets/checkout/radio-off-mobile.svg";
import radioOn from "@/assets/checkout/radio-on-mobile.svg";
import walletIcon from "@/assets/checkout/wallet.svg";
import { useCart } from "@/features/cart/api";
import { quoteQueryKey, requestQuote, toQuoteItems } from "@/features/cart/quote";
import { usePlaceOrder } from "@/features/orders/api";
import { useAddWallet, useWalletAction, useWallets } from "@/features/wallets/api";
import {
  NETWORK_LABELS,
  PROVIDER_LABELS,
  WALLET_NETWORKS,
  WALLET_PROVIDERS,
  isWalletNetwork,
  isWalletProvider,
  shortAddress,
  type Wallet,
  type WalletProvider,
} from "@/features/wallets/types";
import { readApiError } from "@/shared/api/errors";
import type { CartLine, Quote } from "@/shared/domain/contracts";
import { formatEth, mulEth } from "@/shared/domain/money";

const inputClass =
  "h-10 w-full rounded-[3px] border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-kurio-secondary focus-visible:border-primary focus-visible:outline-none aria-[invalid=true]:border-text-coral";

const primaryButton =
  "flex h-[60px] w-full items-center justify-center rounded-[40px] bg-gradient-to-br from-primary to-primary/80 text-[15px] font-bold leading-4 text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-60 lg:h-[45px] lg:rounded-lg lg:bg-primary lg:bg-none";

/** Cotação do checkout: uma vez por carrinho, sem refetch automático, para a revisão não mudar sozinha. */
function useCheckoutQuote(lines: CartLine[], couponCode: string | null) {
  const items = toQuoteItems(lines);
  return useQuery({
    queryKey: [...quoteQueryKey, "checkout", items, couponCode] as const,
    queryFn: ({ signal }) => requestQuote(items, couponCode, signal),
    enabled: lines.length > 0,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="flex items-center text-[15px] leading-[15px] text-foreground">
        {label}
        <span aria-hidden="true" className="text-[22px] leading-[29px] text-text-coral">
          *
        </span>
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs leading-4 text-text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProviderInitial({ provider }: { provider: WalletProvider }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center lg:hidden" aria-hidden="true">
      <img src={providerCircle} alt="" className="absolute inset-0 size-10" />
      {provider === "coinbase" ? (
        <img src={walletIcon} alt="" className="relative size-5" />
      ) : (
        <span className="relative text-sm font-bold text-text-accent">{provider === "metamask" ? "M" : "W"}</span>
      )}
    </span>
  );
}

function AddWalletForm({ onAdded }: { onAdded: (wallet: Wallet) => void }) {
  const add = useAddWallet();
  const [provider, setProvider] = useState<WalletProvider>("metamask");
  const error = add.error ? readApiError(add.error) : null;
  const fields = error?.fields ?? {};
  const formError = error && !error.fields ? error.message : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const network = data.get("network");
    add.mutate(
      {
        label: String(data.get("label") ?? ""),
        address: String(data.get("address") ?? ""),
        network: isWalletNetwork(network) ? network : "ethereum",
        provider,
      },
      {
        onSuccess: (wallet) => {
          form.reset();
          onAdded(wallet);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Adicionar carteira">
      <h2 className="text-base font-bold leading-4 text-foreground">Carteira e rede</h2>

      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Tipo de carteira</legend>
        {WALLET_PROVIDERS.map((option) => (
          <label
            key={option}
            className="relative flex h-[65px] cursor-pointer items-center gap-3 rounded-[15px] bg-surface-card pl-3.5 pr-4 shadow-[0_0_20px_rgba(10,6,4,0.45)] lg:has-[:checked]:border-primary has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary lg:h-[45px] lg:rounded-[3px] lg:border lg:border-border lg:bg-transparent lg:pl-3 lg:shadow-none"
          >
            <input
              type="radio"
              name="provider"
              value={option}
              checked={provider === option}
              onChange={() => isWalletProvider(option) && setProvider(option)}
              className="peer sr-only"
            />
            <img src={provider === option ? radioOn : radioOff} alt="" aria-hidden="true" className="order-last ml-auto size-4 lg:order-first lg:ml-0" />
            <ProviderInitial provider={option} />
            <span className="text-sm text-foreground lg:text-[15px]">{PROVIDER_LABELS[option]}</span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Nome de exibição" htmlFor="wallet-label" error={fields.label}>
          <input
            id="wallet-label"
            name="label"
            maxLength={40}
            autoComplete="off"
            aria-invalid={fields.label !== undefined}
            aria-describedby={fields.label ? "wallet-label-error" : undefined}
            className={inputClass}
          />
        </Field>
        <Field label="Rede" htmlFor="wallet-network" error={fields.network}>
          <div className="relative">
            <select
              id="wallet-network"
              name="network"
              defaultValue="ethereum"
              aria-invalid={fields.network !== undefined}
              className={`${inputClass} appearance-none pr-9 bg-ink`}
            >
              {WALLET_NETWORKS.map((network) => (
                <option key={network} value={network}>
                  {NETWORK_LABELS[network]}
                </option>
              ))}
            </select>
            <img src={arrowDown} alt="" aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 size-[18px] -translate-y-1/2" />
          </div>
        </Field>
        <div className="lg:col-span-2">
          <Field label="Endereço da carteira" htmlFor="wallet-address" error={fields.address}>
            <input
              id="wallet-address"
              name="address"
              autoComplete="off"
              spellCheck={false}
              placeholder="Endereço 0x da carteira"
              aria-invalid={fields.address !== undefined}
              aria-describedby={fields.address ? "wallet-address-error" : undefined}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-text-coral">
          {formError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={add.isPending}
        className="h-10 self-start rounded-[3px] border border-primary px-4 text-sm font-medium text-text-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {add.isPending ? "Adicionando…" : "Adicionar carteira"}
      </button>
    </form>
  );
}

type WalletCardProps = {
  wallet: Wallet;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

function WalletCard({ wallet, selected, busy, onSelect, onConnect, onDisconnect }: WalletCardProps) {
  return (
    <li className="relative flex min-h-[93px] items-start gap-4 rounded-[14px] bg-surface-card px-[19px] py-[15px] shadow-[0_20px_20px_rgba(10,6,4,0.45)]">
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
        <input
          type="radio"
          name="wallet"
          value={wallet.id}
          checked={selected}
          onChange={onSelect}
          className="peer sr-only"
        />
        <img src={selected ? radioOn : radioOff} alt="" aria-hidden="true" className="mt-6 size-4 shrink-0" />
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-base font-bold leading-4 text-foreground">{wallet.label}</span>
          <span className="text-sm leading-[22px] text-text-secondary">
            {shortAddress(wallet.address)}
            <br />
            Rede {NETWORK_LABELS[wallet.network]} · {wallet.connected ? "Conectada" : "Desconectada"}
          </span>
        </span>
      </label>
      <div className="flex flex-col items-end gap-2">
        <img src={kebab} alt="" aria-hidden="true" className="h-[15px] w-[3px]" />
        <button
          type="button"
          disabled={busy}
          onClick={wallet.connected ? onDisconnect : onConnect}
          aria-label={`${wallet.connected ? "Desconectar" : "Conectar"} ${wallet.label}`}
          className="text-sm font-bold leading-4 text-text-accent underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {wallet.connected ? "Desconectar" : "Conectar"}
        </button>
      </div>
    </li>
  );
}

/** Pedido de aprovação simulado: não há extensão, o usuário escolhe aprovar ou recusar aqui. */
function ConnectPrompt({
  wallet,
  busy,
  onApprove,
  onReject,
}: {
  wallet: Wallet;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <section
      aria-label={`Conectar ${wallet.label}`}
      className="flex flex-col gap-3 rounded-[14px] border border-primary bg-surface-card p-4"
    >
      <p className="text-sm leading-[22px] text-foreground">
        {PROVIDER_LABELS[wallet.provider]} pede permissão para conectar <strong>{wallet.label}</strong> (
        {shortAddress(wallet.address)}) na rede {NETWORK_LABELS[wallet.network]}.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="h-10 rounded-[3px] bg-primary px-4 text-sm font-bold text-ink disabled:opacity-60"
        >
          Aprovar conexão
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className="h-10 rounded-[3px] border border-border px-4 text-sm font-medium text-foreground disabled:opacity-60"
        >
          Recusar
        </button>
      </div>
    </section>
  );
}

type WalletsSectionProps = {
  wallets: Wallet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function WalletsSection({ wallets, selectedId, onSelect }: WalletsSectionProps) {
  const act = useWalletAction();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const connecting = wallets.find((wallet) => wallet.id === connectingId) ?? null;
  const connected = wallets.find((wallet) => wallet.connected) ?? null;
  const error = act.error ? readApiError(act.error) : null;

  function run(id: string, action: "connect" | "reject" | "disconnect") {
    act.mutate(
      { id, action },
      {
        onSuccess: () => {
          setConnectingId(null);
          if (action === "connect") onSelect(id);
        },
        onError: () => setConnectingId(null),
      },
    );
  }

  return (
    <section aria-labelledby="wallets-title" className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 id="wallets-title" className="text-base font-bold leading-4 text-foreground">
          {connected ? "Carteira conectada" : "Suas carteiras"}
        </h2>
        <button
          type="button"
          disabled={!connected || act.isPending}
          onClick={() => connected && run(connected.id, "disconnect")}
          className="text-sm font-bold leading-4 text-text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Trocar carteira
        </button>
      </div>

      {wallets.length === 0 ? (
        <p className="text-sm text-text-secondary">Nenhuma carteira ainda. Adicione uma abaixo.</p>
      ) : (
        <ul aria-label="Carteiras" className="flex flex-col gap-5">
          {wallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              selected={wallet.id === selectedId}
              busy={act.isPending}
              onSelect={() => onSelect(wallet.id)}
              onConnect={() => {
                act.reset();
                setConnectingId(wallet.id);
              }}
              onDisconnect={() => run(wallet.id, "disconnect")}
            />
          ))}
        </ul>
      )}

      {connecting ? (
        <ConnectPrompt
          wallet={connecting}
          busy={act.isPending}
          onApprove={() => run(connecting.id, "connect")}
          onReject={() => run(connecting.id, "reject")}
        />
      ) : null}
      {error ? (
        <p role="alert" data-code={error.code} className="text-sm text-text-coral">
          {error.message}
        </p>
      ) : null}
    </section>
  );
}

function SummaryRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between text-[15px] text-foreground ${className}`}>
      <span>{label}</span>
      <span className="text-lg">{value}</span>
    </div>
  );
}

function ItemRows({ lines }: { lines: CartLine[] }) {
  return (
    <div className="hidden flex-col gap-3 lg:flex">
      <div className="flex items-center justify-between text-base leading-4 text-foreground">
        <p className="font-bold">NFTs</p>
        <p className="font-medium">Subtotal</p>
      </div>
      <img src={line} alt="" aria-hidden="true" className="h-[0.3px] w-full" />
      <ul aria-label="Itens do pedido" className="flex flex-col gap-3">
        {lines.map((item) => (
          <li key={item.id} className="flex h-[70px] items-center gap-2 bg-surface-card pl-1 pr-4">
            <img src={item.imageUrl} alt={item.title} width={70} height={70} className="size-[70px] shrink-0 rounded-lg object-cover" />
            <div className="flex w-[154px] flex-col gap-1.5 leading-4">
              <p className="truncate text-base font-bold text-foreground">{item.title}</p>
              <p className="truncate text-sm text-kurio-secondary">ID do token: {item.tokenId}</p>
            </div>
            <div className="ml-auto flex items-center gap-5 text-right">
              <span className="text-sm text-text-secondary">(x {item.quantity})</span>
              <span className="text-lg font-bold text-text-accent">{formatEth(mulEth(item.priceEth, item.quantity))}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrderReview({ lines, reviewed }: { lines: CartLine[]; reviewed: Quote | null }) {
  const pending = "—";
  return (
    <div className="flex flex-col gap-3">
      <h2 className="hidden text-[17px] font-bold leading-4 text-foreground lg:block">Seus NFTs</h2>
      <ItemRows lines={lines} />
      <Link to="/cart" className="hidden text-center text-sm leading-4 text-foreground lg:block">
        Tem um código promocional? Aplique aqui
      </Link>
      <div className="hidden flex-col gap-3 lg:flex">
        <SummaryRow label="Subtotal" value={reviewed ? formatEth(reviewed.subtotalEth) : pending} />
        <SummaryRow label="Desconto do lançamento" value={reviewed ? `(-) ${formatEth(reviewed.discountEth)}` : pending} className="[&_span:last-child]:text-[15px]" />
        <div className="flex flex-col items-center gap-1">
          <SummaryRow label="Taxa de rede" value={reviewed ? formatEth(reviewed.networkFeeEth) : pending} className="w-full" />
          <p className="text-xs leading-4 text-text-accent">Taxa estimada</p>
        </div>
        <img src={lineTotals} alt="" aria-hidden="true" className="h-[0.3px] w-full" />
      </div>
      <div className="flex items-center justify-end gap-7 font-bold leading-4 lg:justify-between">
        <span className="text-base text-foreground">
          Total<span className="lg:hidden">:</span>
        </span>
        <span aria-live="polite" className="text-lg text-text-accent">
          {reviewed ? formatEth(reviewed.totalEth) : pending}
        </span>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div role="status" aria-label="Carregando pagamento" className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="skeleton h-[93px] rounded-[14px]" />
      ))}
    </div>
  );
}

function EmptyCheckout() {
  return (
    <section className="flex flex-col items-start gap-4 py-12">
      <h2 className="text-xl font-bold text-foreground">Seu carrinho está vazio</h2>
      <p className="text-sm text-text-secondary">Escolha um NFT no catálogo para finalizar uma compra.</p>
      <Link to="/" hash="catalogo" className="flex h-10 items-center rounded-[3px] bg-primary px-6 text-[15px] font-bold text-ink">
        Continuar explorando
      </Link>
    </section>
  );
}

export function PaymentPage() {
  const navigate = useNavigate();
  const cart = useCart();
  const quote = useCheckoutQuote(cart.lines, cart.couponCode);
  const wallets = useWallets();
  const place = usePlaceOrder();
  /** `place.isPending` só vira verdadeiro depois do lote de notificações do React Query: um clique duplo passaria. */
  const submitting = useRef(false);

  const [pickedId, setPickedId] = useState<string | null>(null);
  /** Cotação que o usuário aceitou depois de uma mudança de valores. */
  const [accepted, setAccepted] = useState<Quote | null>(null);

  const walletList = wallets.data ?? [];
  const selected = walletList.find((wallet) => wallet.id === pickedId) ?? walletList.find((wallet) => wallet.connected) ?? null;
  const reviewed = accepted ?? quote.data ?? null;
  const changed = place.data?.kind === "changed" ? place.data.quote : null;
  const placeError = place.isError ? readApiError(place.error) : null;
  const canConfirm = selected?.connected === true && reviewed !== null && changed === null && cart.lines.length > 0;

  function confirmPurchase() {
    if (!selected || !reviewed || place.isPending || submitting.current) return;
    submitting.current = true;
    place.mutate(
      { walletId: selected.id, couponCode: cart.couponCode, lines: cart.lines, reviewed },
      {
        onSuccess: (result) => {
          if (result.kind === "placed") {
            void navigate({ to: "/orders/$orderId", params: { orderId: result.order.id } });
          }
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  }

  function acceptNewValues() {
    if (!changed) return;
    setAccepted(changed);
    place.reset();
  }

  return (
    <div className="flex flex-col gap-8 pb-12 pt-4 lg:pt-6">
      <div className="flex flex-col gap-3">
        <nav aria-label="Navegação estrutural" className="hidden lg:block">
          <p className="text-[15px] font-bold leading-4 text-foreground">
            <Link to="/">Início</Link> /{" "}
            <Link to="/" hash="catalogo">
              Mercado
            </Link>{" "}
            / Pagamento
          </p>
        </nav>
        <header className="flex h-11 items-center lg:hidden">
          <Link to="/cart" aria-label="Voltar ao carrinho" className="relative flex size-[35px] items-center justify-center">
            <img src={backCircle} alt="" className="absolute inset-0" />
            <img src={backArrow} alt="" className="relative rotate-90" />
          </Link>
          <h1 className="flex-1 pr-[35px] text-center text-xl font-bold leading-4 text-foreground">Pagamento com carteira</h1>
        </header>
        <h1 className="sr-only max-lg:hidden">Pagamento com carteira</h1>
      </div>

      {cart.isPending || wallets.isPending ? (
        <CheckoutSkeleton />
      ) : cart.isError || wallets.isError ? (
        <section role="alert" className="flex flex-col items-start gap-3 py-8">
          <p className="text-sm text-text-coral">{readApiError(cart.error ?? wallets.error).message}</p>
          <button
            type="button"
            onClick={() => {
              cart.refetch();
              void wallets.refetch();
            }}
            className="h-10 rounded-[3px] border border-primary px-4 text-sm font-medium text-text-accent"
          >
            Tentar novamente
          </button>
        </section>
      ) : cart.lines.length === 0 ? (
        <EmptyCheckout />
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="flex flex-col gap-8 lg:w-[470px]">
            <h2 className="hidden text-[17px] font-bold leading-4 text-foreground lg:block">Perfil do colecionador</h2>
            <WalletsSection wallets={walletList} selectedId={selected?.id ?? null} onSelect={setPickedId} />
            <AddWalletForm onAdded={(wallet) => setPickedId(wallet.id)} />
          </div>

          <aside aria-label="Resumo do pedido" className="flex flex-col gap-5 lg:w-[405px] lg:shrink-0">
            <OrderReview lines={cart.lines} reviewed={reviewed} />

            {quote.isError && !reviewed ? (
              <p role="alert" className="text-sm text-text-coral">
                {readApiError(quote.error).message}
              </p>
            ) : null}

            {changed ? (
              <section role="alert" className="flex flex-col gap-3 rounded-[14px] border border-primary bg-surface-card p-4">
                <p className="text-sm leading-[22px] text-foreground">
                  Os valores mudaram desde a sua revisão. Novo total: <strong className="text-text-accent">{formatEth(changed.totalEth)}</strong>{" "}
                  (taxa de rede {formatEth(changed.networkFeeEth)}). Confirme de novo para continuar.
                </p>
                <button type="button" onClick={acceptNewValues} className="h-10 rounded-[3px] bg-primary px-4 text-sm font-bold text-ink">
                  Confirmar novos valores
                </button>
              </section>
            ) : null}

            {placeError ? (
              <p role="alert" data-code={placeError.code} className="text-sm leading-[22px] text-text-coral">
                {placeError.code === "unknown"
                  ? "Sem resposta do servidor. Toque em confirmar de novo: o pedido não será cobrado duas vezes."
                  : placeError.message}
              </p>
            ) : null}
            {selected && !selected.connected ? (
              <p className="text-xs leading-4 text-text-secondary">Conecte {selected.label} para confirmar a compra.</p>
            ) : null}
            {!selected ? <p className="text-xs leading-4 text-text-secondary">Conecte uma carteira para confirmar a compra.</p> : null}

            <button
              type="button"
              disabled={!canConfirm || place.isPending}
              aria-busy={place.isPending}
              onClick={confirmPurchase}
              className={primaryButton}
            >
              {place.isPending ? "Confirmando…" : "Confirmar compra"}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
