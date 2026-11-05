import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Heart, Search, ShoppingCart } from "lucide-react";
import type { MouseEvent } from "react";
import { captureSessionIdentity, isCurrentSession, privateQueryKey } from "@/features/auth/session-identity";
import { cartQueryKey, useCart, useCartActions } from "@/features/cart/api";
import { useFavorite } from "@/features/favorites/use-favorite";
import { addToCart, isUnauthorized } from "@/features/nft/api";
import { readApiError } from "@/shared/api/errors";
import { formatEth } from "@/shared/domain/money";
import type { NftSummary } from "@/shared/domain/contracts";
import { pushToast } from "@/shared/ui/toast";
import { cn } from "@/lib/utils";

const QUICK_EDITION_ID = "ed-1-50";

const actionClass =
  "relative z-20 flex size-9 items-center justify-center rounded-md border border-border bg-[#2F1D15] text-foreground transition-colors hover:border-text-accent hover:text-text-accent disabled:opacity-60";

export function NftCard({ nft, compact = false }: { nft: NftSummary; compact?: boolean }) {
  const favorite = useFavorite(nft.slug);
  const cart = useCart();
  const linesForNft = cart.lines.filter((line) => line.slug === nft.slug);
  const cartQty = linesForNft.reduce((sum, line) => sum + line.quantity, 0);
  const inCart = cartQty > 0;
  const { remove } = useCartActions(cart.isGuest);
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();

  const add = useMutation({
    mutationFn: addToCart,
    onMutate: () => captureSessionIdentity(),
    onSuccess: (_item, _input, identity) => {
      if (!isCurrentSession(identity)) return;
      if (identity.userId) void client.invalidateQueries({ queryKey: privateQueryKey(identity.userId, "cart") });
      void client.invalidateQueries({ queryKey: cartQueryKey });
      pushToast("Adicionado ao carrinho");
    },
    onError: (error, _input, identity) => {
      if (!identity || !isCurrentSession(identity)) return;
      if (isUnauthorized(error)) {
        void navigate({ to: "/login", search: { redirect: location.href } });
      }
    },
  });

  const cartBusy = add.isPending || remove.isPending;

  async function handleToggleCart(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (cartBusy) return;

    if (inCart) {
      for (const line of linesForNft) {
        await remove.mutateAsync(line);
      }
      pushToast("Removido do carrinho");
      return;
    }

    if (nft.available <= 0) return;
    add.mutate({
      slug: nft.slug,
      editionId: QUICK_EDITION_ID,
      quantity: 1,
      available: nft.available,
    });
  }

  function handleFavorite(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    favorite.toggle();
  }

  return (
    <article
      aria-label={nft.title}
      className={cn(
        "group relative flex w-full flex-col gap-2 sm:w-[258px] sm:gap-3",
        compact && "lg:w-[219px]",
      )}
    >
      <div
        className={cn(
          "relative flex h-[200px] items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-surface-card to-[#2F1D15] px-1 sm:h-[300px] sm:rounded-none sm:bg-surface-card sm:bg-none sm:px-1 sm:pt-6 sm:pb-7",
          compact && "lg:h-[255px] lg:py-0",
        )}
      >
        <img
          src={nft.imageUrl}
          alt=""
          loading="lazy"
          width={250}
          height={250}
          className={cn(
            "size-[168px] rounded-2xl object-cover sm:size-[250px] sm:rounded-[15px]",
            compact && "lg:size-[211px]",
          )}
        />

        <div
          className={cn(
            "absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-2 transition-opacity sm:bottom-8",
            "opacity-100 lg:pointer-events-none lg:opacity-0 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100",
          )}
        >
          <button
            type="button"
            aria-label={
              inCart ? `Remover ${nft.title} do carrinho` : `Adicionar ${nft.title} ao carrinho`
            }
            aria-pressed={inCart}
            disabled={cartBusy || (!inCart && nft.available <= 0)}
            onClick={handleToggleCart}
            className={cn(actionClass, inCart && "border-text-accent text-text-accent")}
          >
            <ShoppingCart className={cn("size-4", inCart && "fill-current")} strokeWidth={1.75} />
            {cartQty > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold leading-none text-ink">
                {cartQty > 99 ? "99+" : cartQty}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            aria-label={
              favorite.isFavorite ? `Remover ${nft.title} dos favoritos` : `Favoritar ${nft.title}`
            }
            aria-pressed={favorite.isFavorite}
            disabled={favorite.isPending}
            onClick={handleFavorite}
            className={cn(actionClass, favorite.isFavorite && "border-text-accent text-text-accent")}
          >
            <Heart className={cn("size-4", favorite.isFavorite && "fill-current")} strokeWidth={1.75} />
          </button>
          <Link
            to="/nfts/$slug"
            params={{ slug: nft.slug }}
            aria-label={`Ver detalhes de ${nft.title}`}
            className={actionClass}
            onClick={(event) => event.stopPropagation()}
          >
            <Search className="size-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      {favorite.isError ? (
        <p
          role="alert"
          className="absolute top-3 right-2 left-2 z-10 rounded bg-surface-card/95 p-2 text-xs text-text-coral"
        >
          {readApiError(favorite.error).message}{" "}
          <button type="button" className="underline" onClick={favorite.retry}>
            Tentar novamente
          </button>
        </p>
      ) : null}

      <div className="flex flex-col gap-[6px] px-2 sm:gap-1.5 sm:px-0">
        <h3
          className={cn(
            "text-[15px] font-normal leading-4 text-foreground sm:text-base",
            compact && "lg:text-[15px]",
          )}
        >
          <Link
            to="/nfts/$slug"
            params={{ slug: nft.slug }}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-primary"
          >
            {nft.title}
          </Link>
        </h3>
        <p
          className={cn(
            "flex items-center gap-3 text-base font-bold leading-4 text-text-accent sm:text-lg",
            compact && "lg:text-base",
          )}
        >
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
