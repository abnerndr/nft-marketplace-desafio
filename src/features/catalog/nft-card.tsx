import { formatEth } from "@/shared/domain/money";
import type { NftSummary } from "@/shared/domain/contracts";

export function NftCard({ nft }: { nft: NftSummary }) {
  return (
    <article
      aria-label={nft.title}
      className="flex w-full flex-col gap-2 sm:w-[258px] sm:gap-3"
    >
      <div className="flex h-[200px] items-start justify-center rounded-[20px] bg-gradient-to-br from-surface-card to-[#2F1D15] px-1 pt-3 sm:h-[300px] sm:rounded-none sm:bg-surface-card sm:bg-none sm:pt-6">
        <img
          src={nft.imageUrl}
          alt={nft.title}
          loading="lazy"
          width={250}
          height={250}
          className="size-[168px] rounded-2xl object-cover sm:size-[250px] sm:rounded-[15px]"
        />
      </div>
      <div className="flex flex-col gap-[6px] px-2 sm:gap-3 sm:px-0">
        <h3 className="text-[15px] font-normal leading-4 text-foreground sm:text-base">
          {nft.title}
        </h3>
        <p className="flex items-center gap-3 text-base font-bold leading-4 text-text-accent sm:text-lg">
          <span>{formatEth(nft.priceEth)}</span>
          {nft.compareAtEth ? (
            <s
              aria-label={`Preço anterior ${formatEth(nft.compareAtEth)}`}
              className="font-normal text-kurio-secondary"
            >
              {formatEth(nft.compareAtEth)}
            </s>
          ) : null}
        </p>
      </div>
    </article>
  );
}

export function NftCardSkeleton() {
  return (
    <div
      data-testid="nft-card-skeleton"
      aria-hidden="true"
      className="flex h-[256px] w-full animate-pulse flex-col gap-3 sm:h-[356px] sm:w-[258px]"
    >
      <div className="h-[200px] rounded-[20px] bg-surface-card sm:h-[300px] sm:rounded-none" />
      <div className="mx-2 h-4 w-3/4 rounded bg-surface-card sm:mx-0" />
      <div className="mx-2 h-4 w-1/3 rounded bg-surface-card sm:mx-0" />
    </div>
  );
}
