import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import close from "@/assets/orders/close.svg";
import lineMeta from "@/assets/orders/line-meta.svg";
import lineTable from "@/assets/orders/line-table.svg";
import thankYou from "@/assets/orders/thank-you.svg";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NETWORK_LABELS, isWalletNetwork } from "@/features/wallets/types";
import { readApiError } from "@/shared/api/errors";
import type { Order } from "@/shared/domain/contracts";
import { cmpEth, formatEth, mulEth } from "@/shared/domain/money";
import { useOrder } from "./api";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-07-29T…" vira "29 Jul, 2026". */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const month = MONTHS[date.getMonth()];
  return `${date.getDate()} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${date.getFullYear()}`;
}

/** "0xa91f…e82c" no formato do recibo: 0xA91F…E82C. */
function shortTx(txRef: string): string {
  if (txRef.length <= 12) return txRef;
  return `0x${txRef.slice(2, 6).toUpperCase()}…${txRef.slice(-4).toUpperCase()}`;
}

const EXPLORERS = {
  ethereum: { name: "Etherscan", url: (tx: string) => `https://etherscan.io/tx/${tx}` },
  polygon: { name: "Polygonscan", url: (tx: string) => `https://polygonscan.com/tx/${tx}` },
  solana: { name: "Solscan", url: (tx: string) => `https://solscan.io/tx/${tx}` },
} as const;

function Meta({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col text-text-secondary">
      <dt className={`text-sm leading-4 ${bold ? "font-bold" : ""}`}>{label}</dt>
      <dd className="truncate text-[15px]">{value}</dd>
    </div>
  );
}

function Divider() {
  return (
    <span aria-hidden="true" className="hidden h-[31px] w-0 items-center justify-center sm:flex">
      <img src={lineMeta} alt="" className="w-[31px] max-w-none rotate-90" />
    </span>
  );
}

function Receipt({ order }: { order: Order }) {
  const { snapshot, wallet } = order;
  const network = isWalletNetwork(wallet.network) ? wallet.network : "ethereum";
  const explorer = EXPLORERS[network];
  const hasDiscount = cmpEth(snapshot.discountEth, "0") !== 0;

  return (
    <article
      aria-labelledby="receipt-title"
      className="relative flex w-full max-w-[578px] flex-col overflow-hidden bg-surface-card"
    >
      <Link to="/" aria-label="Fechar recibo" className="absolute right-3 top-3 size-4">
        <img src={close} alt="" />
      </Link>

      <header className="flex h-[156px] flex-col items-center justify-center gap-4">
        <img src={thankYou} alt="" aria-hidden="true" className="size-20" />
        <h1 id="receipt-title" className="text-center text-base font-bold leading-4 text-text-secondary">
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>
      <div className="h-px bg-primary" />

      <dl className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-3 sm:px-9">
        <Meta label="ID da transação" value={order.txRef ? shortTx(order.txRef) : "—"} bold />
        <Divider />
        <Meta label="Data" value={formatDate(order.createdAt)} />
        <Divider />
        <Meta label="Total" value={formatEth(snapshot.totalEth)} />
        <Divider />
        <Meta label="Carteira" value={wallet.label} bold />
      </dl>
      <div className="h-px bg-primary" />

      <div className="flex flex-col gap-3 px-5 pb-12 pt-5 sm:px-11">
        <h2 className="text-[15px] font-bold leading-4 text-foreground">Detalhes da transação</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-base leading-4 text-foreground">
            <p className="font-bold">NFTs</p>
            <div className="flex gap-6 sm:gap-12">
              <p className="font-bold">Edições</p>
              <p className="font-medium">Subtotal</p>
            </div>
          </div>
          <img src={lineTable} alt="" aria-hidden="true" className="h-[0.3px] w-full" />
          <ul aria-label="Itens do pedido" className="flex flex-col gap-3">
            {snapshot.items.map((item) => (
              <li key={`${item.slug}~${item.editionId}`} className="flex min-h-[70px] items-center justify-between gap-3 bg-surface-card">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={item.imageUrl} alt={item.title} width={70} height={70} className="size-[70px] shrink-0 rounded-lg object-cover" />
                  <div className="flex min-w-0 flex-col gap-1.5 leading-4">
                    <p className="truncate text-base font-bold text-foreground">{item.title}</p>
                    <p className="truncate text-sm text-kurio-secondary">ID do token: {item.tokenId}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-right sm:gap-12">
                  <span className="text-sm text-text-secondary">(x {item.quantity})</span>
                  <span className="text-lg font-bold text-text-accent">{formatEth(mulEth(item.priceEth, item.quantity))}</span>
                </div>
              </li>
            ))}
          </ul>
          <dl className="ml-auto flex w-full max-w-[321px] flex-col gap-3">
            {hasDiscount ? (
              <TotalRow label={`Desconto${snapshot.couponCode ? ` (${snapshot.couponCode})` : ""}`} value={`(-) ${formatEth(snapshot.discountEth)}`} />
            ) : null}
            <TotalRow label="Taxa de rede" value={formatEth(snapshot.networkFeeEth)} />
            <div className="flex items-center justify-between font-bold leading-4">
              <dt className="text-base text-foreground">Total</dt>
              <dd className="text-lg text-text-accent">{formatEth(snapshot.totalEth)}</dd>
            </div>
          </dl>
          <img src={lineTable} alt="" aria-hidden="true" className="h-[0.3px] w-full" />
        </div>

        <div className="flex flex-col items-center gap-6">
          <p className="text-center text-sm leading-[22px] text-text-secondary">
            Transação confirmada na {NETWORK_LABELS[network]}. A propriedade foi transferida para sua carteira conectada e registrada na
            rede. O link do explorador é simulado: não há blockchain real neste desafio.
          </p>
          {order.txRef ? (
            <a
              href={explorer.url(order.txRef)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[5px] bg-primary p-4 text-base font-bold leading-4 text-ink"
            >
              Ver no {explorer.name} (simulado)
            </a>
          ) : null}
        </div>
      </div>
      <div className="h-[10px] bg-primary" />
    </article>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-foreground">
      <dt className="text-[15px]">{label}</dt>
      <dd className="text-lg leading-4">{value}</dd>
    </div>
  );
}

function StatusCard({ role, title, children }: { role: "status" | "alert"; title: string; children: ReactNode }) {
  return (
    <section role={role} className="flex w-full max-w-[578px] flex-col items-center gap-4 bg-surface-card px-6 py-12 text-center">
      <h1 className="text-xl font-bold leading-6 text-foreground">{title}</h1>
      {children}
    </section>
  );
}

const linkButton = "flex h-10 items-center rounded-[3px] bg-primary px-6 text-[15px] font-bold text-ink";

/** Recibo só quando o servidor diz `confirmed`. Pendente espera; recusado mostra o motivo sem recibo. */
export function ConfirmationPage({ orderId }: { orderId: string }) {
  const order = useOrder(orderId);

  let body: ReactNode;
  if (order.isPending) {
    body = (
      <StatusCard role="status" title="Carregando pedido">
        <p className="text-sm text-text-secondary">Buscando o estado do seu pedido…</p>
      </StatusCard>
    );
  } else if (order.isError) {
    const error = readApiError(order.error);
    body = (
      <StatusCard role="alert" title={error.code === "not_found" ? "Pedido não encontrado" : "Não foi possível carregar o pedido"}>
        <p className="text-sm text-text-coral">{error.message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => void order.refetch()} className="h-10 rounded-[3px] border border-primary px-4 text-sm font-medium text-text-accent">
            Tentar novamente
          </button>
          <Link to="/" className={linkButton}>
            Voltar ao catálogo
          </Link>
        </div>
      </StatusCard>
    );
  } else if (order.data.status === "confirmed") {
    body = <Receipt order={order.data} />;
  } else if (order.data.status === "declined") {
    body = (
      <StatusCard role="alert" title="Pagamento recusado">
        <p className="text-sm leading-[22px] text-text-secondary">
          A carteira recusou o pagamento. Nada foi cobrado e os itens continuam no seu carrinho.
        </p>
        <div className="flex gap-3">
          <Link to="/checkout" className={linkButton}>
            Tentar de novo
          </Link>
          <Link to="/cart" className="flex h-10 items-center rounded-[3px] border border-primary px-4 text-sm font-medium text-text-accent">
            Voltar ao carrinho
          </Link>
        </div>
      </StatusCard>
    );
  } else {
    body = (
      <StatusCard role="status" title="Aguardando confirmação">
        <p className="text-sm leading-[22px] text-text-secondary">
          Recebemos o seu pedido e estamos esperando a rede confirmar. Esta página atualiza sozinha.
        </p>
      </StatusCard>
    );
  }

  const navigate = useNavigate();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const confirmed = order.data?.status === "confirmed";

  if (desktop && confirmed && order.data) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) void navigate({ to: "/" });
        }}
      >
        <DialogContent className="max-h-[90vh] w-[min(100%,578px)] overflow-y-auto border-0 bg-transparent p-0 shadow-none" showClose={false}>
          <DialogTitle className="sr-only">Seus NFTs agora estão na sua carteira</DialogTitle>
          <DialogDescription className="sr-only">Recibo da compra simulada</DialogDescription>
          <Receipt order={order.data} />
        </DialogContent>
      </Dialog>
    );
  }

  return <div className="flex justify-center py-8 lg:py-16">{body}</div>;
}
