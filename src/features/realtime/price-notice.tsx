import { formatEth } from "@/shared/domain/money";
import { dismissPriceNotice, usePriceNotices } from "./notices";

/** Avisa que um preço mudou por evento do servidor. Fica visível até a pessoa dispensar. */
export function PriceNotices() {
  const notices = usePriceNotices();
  if (notices.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pt-4" role="status" aria-live="polite">
      <ul className="flex flex-col gap-2">
        {notices.map((notice) => (
          <li
            key={notice.eventId}
            data-testid="price-notice"
            className="flex items-center justify-between gap-4 rounded-lg border border-text-accent/40 bg-white/5 px-4 py-3 text-sm"
          >
            <span>
              O preço de <strong>{notice.title}</strong> mudou de {formatEth(notice.fromEth)} para{" "}
              <strong className="text-text-accent">{formatEth(notice.toEth)}</strong>. O resumo foi atualizado.
            </span>
            <button
              type="button"
              className="shrink-0 text-text-accent underline underline-offset-4"
              onClick={() => dismissPriceNotice(notice.eventId)}
            >
              Entendi
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
