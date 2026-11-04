import { Link } from "@tanstack/react-router";
import heartSmall from "@/assets/nft/heart-small.svg";
import { useFavorite } from "@/features/favorites/use-favorite";
import { readApiError } from "@/shared/api/errors";
import { formatEth } from "@/shared/domain/money";
import type { NftSummary } from "@/shared/domain/contracts";

export function NftCard({ nft, compact = false }: { nft: NftSummary; compact?: boolean }) {
  const favorite = useFavorite(nft.slug);
  return (
    <article
      aria-label={nft.title}
      className={`group relative flex w-full flex-col gap-2 sm:w-[258px] sm:gap-3 ${compact ? "lg:w-[219px]" : ""}`}
    >
      <div className={`relative flex h-[200px] items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-surface-card to-[#2F1D15] px-1 sm:h-[300px] sm:rounded-none sm:bg-surface-card sm:bg-none sm:px-1 sm:pt-6 sm:pb-7 ${compact ? "lg:h-[255px] lg:py-0" : ""}`}>
        <img
          src={nft.imageUrl}
          alt={nft.title}
          loading="lazy"
          width={250}
          height={250}
          className={`size-[168px] rounded-2xl object-cover sm:size-[250px] sm:rounded-[15px] ${compact ? "lg:size-[211px]" : ""}`}
        />
      </div>
      <button
        type="button"
        aria-label={
          favorite.isFavorite ? `Remover ${nft.title} dos favoritos` : `Favoritar ${nft.title}`
        }
        aria-pressed={favorite.isFavorite}
        onClick={favorite.toggle}
        disabled={favorite.isPending}
        className={`absolute right-3 top-3 z-10 flex size-[35px] items-center justify-center rounded-full border border-border transition-colors disabled:opacity-60 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 ${
          favorite.isFavorite ? "bg-primary/30" : "bg-[#2F1D15]"
        }`}
      >
        <img src={heartSmall} alt="" />
      </button>
      {favorite.isError ? (
        <p
          role="alert"
          className="absolute top-[48px] right-2 left-2 z-10 rounded bg-surface-card/95 p-2 text-xs text-text-coral"
        >
          {readApiError(favorite.error).message}{" "}
          <button type="button" className="underline" onClick={favorite.retry}>
            Tentar novamente
          </button>
        </p>
      ) : null}
      <div className="flex flex-col gap-[6px] px-2 sm:gap-1.5 sm:px-0">
        <h3 className={`text-[15px] font-normal leading-4 text-foreground sm:text-base ${compact ? "lg:text-[15px]" : ""}`}>
          <Link
            to="/nfts/$slug"
            params={{ slug: nft.slug }}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-primary"
          >
            {nft.title}
          </Link>
        </h3>
        <p className={`flex items-center gap-3 text-base font-bold leading-4 text-text-accent sm:text-lg ${compact ? "lg:text-base" : ""}`}>
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
      className="flex h-[256px] w-full flex-col gap-3 sm:h-[356px] sm:w-[258px]"
    >
      <div className="skeleton h-[200px] rounded-[20px] sm:h-[300px] sm:rounded-none" />
      <div className="skeleton mx-2 h-4 w-3/4 rounded sm:mx-0" />
      <div className="skeleton mx-2 h-4 w-1/3 rounded sm:mx-0" />
    </div>
  );
}
