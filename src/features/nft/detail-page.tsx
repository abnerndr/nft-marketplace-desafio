import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import arrowLeft from "@/assets/nft/arrow-left.svg";
import heart from "@/assets/nft/heart.svg";
import heartSmall from "@/assets/nft/heart-small.svg";
import lineDetails from "@/assets/nft/line-details.svg";
import lineSection from "@/assets/nft/line-section.svg";
import lineTab from "@/assets/nft/line-tab.svg";
import linkedin from "@/assets/nft/linkedin.svg";
import message from "@/assets/nft/message.svg";
import minus from "@/assets/nft/minus.svg";
import minusMobile from "@/assets/nft/minus-mobile.svg";
import pillActive from "@/assets/nft/pill-active.svg";
import pillIdle from "@/assets/nft/pill-m.svg";
import plus from "@/assets/nft/plus.svg";
import plusMobile from "@/assets/nft/plus-mobile.svg";
import shop from "@/assets/nft/shop.svg";
import starEmpty from "@/assets/nft/star-empty.svg";
import starFilled from "@/assets/nft/star-filled.svg";
import starMobile from "@/assets/nft/star-mobile.svg";
import twitter from "@/assets/nft/twitter.svg";
import { nftListQuery } from "@/features/catalog/api";
import { NftCard } from "@/features/catalog/nft-card";
import { toParams, type CollectionId } from "@/features/catalog/search";
import { captureSessionIdentity, isCurrentSession, privateQueryKey } from "@/features/auth/session-identity";
import { cartQueryKey } from "@/features/cart/api";
import { useFavorite } from "@/features/favorites/use-favorite";
import { readApiError } from "@/shared/api/errors";
import type { Edition, NftDetail } from "@/shared/domain/contracts";
import { formatEth } from "@/shared/domain/money";
import { addToCart, isNotFound, isUnauthorized, nftDetailQuery } from "./api";
import { NftGallery } from "./gallery";

const RELATED_COUNT = 5;
const PREFERRED_EDITION_ID = "ed-1-50";

/** Edição aberta ao entrar: a 1/50 do frame, ou a primeira com unidades. */
function defaultEdition(editions: Edition[]): Edition | undefined {
  return (
    editions.find((edition) => edition.id === PREFERRED_EDITION_ID && edition.available > 0) ??
    editions.find((edition) => edition.available > 0) ??
    editions[0]
  );
}

function parseQuantity(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text) : Number.NaN;
}

function quantityProblem(quantity: number, max: number): string | null {
  if (Number.isInteger(quantity) && quantity >= 1 && quantity <= max) return null;
  return `Informe uma quantidade inteira de 1 a ${max}.`;
}

const stepperButton =
  "flex h-[30px] w-5 shrink-0 items-center justify-center rounded-[20px] border border-ink bg-primary shadow-[0_4px_6px_rgba(20,13,10,0.15)] transition-opacity disabled:opacity-40 lg:h-[49.5px] lg:w-[33px] lg:rounded-[33px] lg:shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)]";

function EditionPills({
  editions,
  selectedId,
  onSelect,
}: {
  editions: Edition[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="group" aria-label="Edição" className="flex flex-wrap items-center gap-3 lg:gap-1.5">
      {editions.map((edition) => {
        const selected = edition.id === selectedId;
        const soldOut = edition.available === 0;
        return (
          <button
            key={edition.id}
            type="button"
            aria-pressed={selected}
            aria-label={soldOut ? `${edition.label}, esgotada` : edition.label}
            onClick={() => onSelect(edition.id)}
            className="relative flex h-7 min-w-9 items-center justify-center px-3 text-sm leading-4 lg:px-2"
          >
            <img
              src={selected ? pillActive : pillIdle}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full max-w-none"
            />
            <span
              className={`relative ${
                selected ? "font-medium text-text-accent" : "text-text-secondary"
              } ${soldOut ? "line-through opacity-60" : ""}`}
            >
              {edition.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Rating({ rating }: { rating: NftDetail["rating"] }) {
  return (
    <>
      <p className="hidden items-center gap-1 text-[15px] text-foreground lg:flex">
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <img key={index} src={starFilled} alt="" />
          ))}
          <img src={starEmpty} alt="" />
        </span>
        <span>{rating.count} avaliações de colecionadores</span>
      </p>
      <p className="flex h-[27px] items-center gap-1.5 rounded-[32px] border border-primary px-2.5 text-sm leading-4 lg:hidden"
      >
        <img src={starMobile} alt="" aria-hidden="true" />
        <span className="sr-only">Nota</span>
        <span className="font-medium text-foreground">{rating.average}</span>
        <span className="text-text-secondary">
          ({rating.count}
          <span className="sr-only"> avaliações</span>)
        </span>
      </p>
    </>
  );
}

function ShareLinks({ title }: { title: string }) {
  const url = typeof window === "undefined" ? "" : window.location.href;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const linkProps = { target: "_blank", rel: "noopener noreferrer" } as const;
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <p className="text-[15px] font-bold leading-4 text-foreground">Compartilhar este NFT:</p>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        aria-label="Compartilhar no LinkedIn"
        {...linkProps}
      >
        <img src={linkedin} alt="" />
      </a>
      <a
        href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}
        aria-label="Compartilhar por e-mail"
      >
        <img src={message} alt="" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        aria-label="Compartilhar no Twitter"
        {...linkProps}
      >
        <img src={twitter} alt="" />
      </a>
    </div>
  );
}


function PurchaseBar({ nft }: { nft: NftDetail }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [editionId, setEditionId] = useState(() => defaultEdition(nft.editions)?.id ?? "");
  const [quantityText, setQuantityText] = useState("1");

  const edition = nft.editions.find((candidate) => candidate.id === editionId);
  const max = edition?.available ?? 0;
  const soldOut = max === 0;
  const quantity = parseQuantity(quantityText);
  const problem = soldOut ? null : quantityProblem(quantity, max);

  const favorite = useFavorite(nft.slug);

  const add = useMutation({
    mutationFn: addToCart,
    onMutate: () => captureSessionIdentity(),
    onSuccess: (_item, _input, identity) => {
      if (!isCurrentSession(identity)) return;
      if (identity.userId) void client.invalidateQueries({ queryKey: privateQueryKey(identity.userId, "cart") });
      void client.invalidateQueries({ queryKey: cartQueryKey });
    },
    onError: (error, _input, identity) => {
      if (!identity || !isCurrentSession(identity)) return;
      if (isUnauthorized(error)) {
        void navigate({ to: "/login", search: { redirect: `/nfts/${nft.slug}` } });
      }
    },
  });

  const canBuy = !soldOut && problem === null && !add.isPending && edition !== undefined;

  function selectEdition(id: string) {
    const next = nft.editions.find((candidate) => candidate.id === id);
    setEditionId(id);
    add.reset();
    // Quantidade acima do estoque da nova edição volta para o máximo dela.
    if (next && next.available > 0 && parseQuantity(quantityText) > next.available) {
      setQuantityText(String(next.available));
    }
  }

  function step(delta: number) {
    const base = Number.isInteger(quantity) ? quantity : 1;
    setQuantityText(String(Math.min(Math.max(base + delta, 1), Math.max(max, 1))));
    add.reset();
  }

  function buy() {
    if (!canBuy || !edition) return;
    add.mutate({ slug: nft.slug, editionId: edition.id, quantity, available: edition.available });
  }

  const failure =
    add.isError && !isUnauthorized(add.error) ? readApiError(add.error).message : null;

  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-bold leading-4 text-foreground">Edição:</p>
        <EditionPills editions={nft.editions} selectedId={editionId} onSelect={selectEdition} />
        {soldOut ? (
          <p role="status" className="text-sm text-text-coral">
            Esta edição está esgotada.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[58px] max-lg:z-20 max-lg:rounded-t-[40px] max-lg:bg-surface-card max-lg:px-6 max-lg:pb-5 max-lg:pt-5 max-lg:shadow-[0_0_10px_rgba(10,6,4,0.45)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center justify-between lg:justify-start">
            <div className="flex items-center gap-2">
              <label
                htmlFor="nft-quantity"
                className="text-[15px] font-medium text-text-secondary lg:sr-only"
              >
                Qtd.
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  disabled={soldOut || !(quantity > 1)}
                  onClick={() => step(-1)}
                  className={stepperButton}
                >
                  <img src={minusMobile} alt="" className="lg:hidden" />
                  <img src={minus} alt="" className="hidden lg:block" />
                </button>
                <input
                  id="nft-quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(max, 1)}
                  step={1}
                  value={quantityText}
                  disabled={soldOut}
                  aria-invalid={problem !== null}
                  aria-describedby={problem ? "nft-quantity-error" : undefined}
                  onChange={(event) => {
                    setQuantityText(event.target.value);
                    add.reset();
                  }}
                  className="w-10 bg-transparent text-center text-lg font-medium leading-[25px] text-foreground outline-none [appearance:textfield] focus-visible:ring-2 focus-visible:ring-primary lg:text-xl lg:font-normal [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  disabled={soldOut || !(quantity < max)}
                  onClick={() => step(1)}
                  className={stepperButton}
                >
                  <img src={plusMobile} alt="" className="lg:hidden" />
                  <img src={plus} alt="" className="hidden lg:block" />
                </button>
              </div>
            </div>
            <p className="text-xl font-bold leading-4 text-text-accent lg:hidden">
              {formatEth(nft.priceEth)}
            </p>
          </div>

          <div className="flex items-center gap-3 lg:gap-2">
            <button
              type="button"
              disabled={!canBuy}
              onClick={buy}
              className="flex h-[60px] w-[196px] items-center justify-center rounded-[40px] bg-gradient-to-r from-primary to-primary/80 text-base font-bold text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-50 lg:h-10 lg:w-[130px] lg:rounded-md lg:bg-none lg:bg-primary lg:text-sm"
            >
              <span className="lg:hidden">{add.isPending ? "Adicionando..." : "Comprar NFT"}</span>
              <span className="hidden lg:inline">{add.isPending ? "ADICIONANDO..." : "COMPRAR"}</span>
            </button>
            <Link
              to="/cart"
              aria-label="Ver carrinho"
              className="flex size-[60px] items-center justify-center rounded-[40px] border border-border bg-[#2F1D15] lg:hidden"
            >
              <img src={shop} alt="" />
            </Link>
            <button
              type="button"
              aria-pressed={favorite.isFavorite}
              onClick={favorite.toggle}
              disabled={favorite.isPending}
              className={`hidden h-10 w-[130px] items-center justify-center gap-2 rounded-md border border-primary text-sm font-medium text-text-accent transition-colors hover:bg-primary/10 disabled:opacity-60 lg:flex ${
                favorite.isFavorite ? "bg-primary/20" : ""
              }`}
            >
              <img src={heart} alt="" />
              {favorite.isFavorite ? "Favoritado" : "Favoritar"}
            </button>
          </div>
        </div>

        {problem ? (
          <p id="nft-quantity-error" role="alert" className="text-sm text-text-coral">
            {problem}
          </p>
        ) : null}
        {failure ? (
          <p role="alert" className="text-sm text-text-coral">
            {failure}
          </p>
        ) : null}
        {add.isSuccess ? (
          <p role="status" className="text-sm text-text-secondary">
            Adicionado ao carrinho.{" "}
            <Link to="/cart" className="font-bold text-text-accent underline">
              Ver carrinho
            </Link>
          </p>
        ) : null}
      </div>
    </>
  );
}

function Description({ nft }: { nft: NftDetail }) {
  return (
    <section aria-labelledby="nft-description-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        <div className="flex w-[161px] flex-col gap-3">
          <h2 id="nft-description-title" className="text-[17px] font-bold leading-4 text-text-accent">
            Detalhes do NFT
          </h2>
          <img src={lineTab} alt="" aria-hidden="true" className="h-[3px] w-full" />
        </div>
        <img src={lineSection} alt="" aria-hidden="true" className="-mt-3 h-[0.3px] w-full" />
      </div>
      <div className="flex flex-col gap-6 text-sm leading-6 text-text-secondary">
        <div className="flex flex-col gap-6">
          {nft.about.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div>
          <h3 className="font-bold text-foreground">Rede:</h3>
          <p>{nft.networkNote}</p>
        </div>
        <div>
          <h3 className="font-bold text-foreground">Contrato:</h3>
          <p>{nft.contractNote}</p>
        </div>
        <div>
          <h3 className="font-bold text-foreground">Direitos autorais:</h3>
          <p>{nft.royaltyNote}</p>
        </div>
      </div>
    </section>
  );
}

function RelatedNfts({ nft }: { nft: NftDetail }) {
  const params = {
    ...toParams({}),
    collection: [nft.collection as CollectionId],
    pageSize: RELATED_COUNT + 1,
  };
  const related = useQuery(nftListQuery(params));
  const items = (related.data?.items ?? [])
    .filter((item) => item.slug !== nft.slug)
    .slice(0, RELATED_COUNT);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 id="related-title" className="text-[17px] font-bold leading-4 text-text-accent">
          Mais desta coleção
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

function DetailContent({ nft }: { nft: NftDetail }) {
  const favorite = useFavorite(nft.slug);
  return (
    <article
      aria-label={nft.title}
      className="flex flex-col gap-12 pb-[220px] pt-4 lg:gap-24 lg:pb-12 lg:pt-6"
    >
      <div className="flex flex-col gap-3">
        <nav aria-label="Navegação estrutural" className="hidden lg:block">
          <p className="text-[15px] font-bold leading-4 text-foreground">
            <Link to="/">Início</Link> /{" "}
            <Link to="/" hash="catalogo">
              Mercado
            </Link>
          </p>
        </nav>

        <div className="flex items-center justify-between lg:hidden">
          <Link
            to="/"
            aria-label="Voltar ao catálogo"
            className="flex size-[35px] items-center justify-center rounded-full border border-border bg-[#2F1D15]"
          >
            <img src={arrowLeft} alt="" className="rotate-90" />
          </Link>
          <button
            type="button"
            aria-label={favorite.isFavorite ? "Remover dos favoritos" : "Favoritar"}
            aria-pressed={favorite.isFavorite}
            onClick={favorite.toggle}
            disabled={favorite.isPending}
            className={`flex size-[35px] items-center justify-center rounded-full border border-border disabled:opacity-60 ${
              favorite.isFavorite ? "bg-primary/30" : "bg-[#2F1D15]"
            }`}
          >
            <img src={heartSmall} alt="" />
          </button>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <NftGallery title={nft.title} images={nft.images} />

          <div className="flex flex-col gap-3 rounded-t-[31px] bg-surface-card px-6 pb-6 pt-8 lg:min-w-px lg:flex-1 lg:justify-between lg:gap-6 lg:rounded-none lg:bg-transparent lg:p-0">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-stretch lg:justify-start">
                  <h1 className="text-xl font-bold leading-4 text-foreground lg:text-[28px] lg:leading-normal">
                    {nft.title}
                  </h1>
                  <div className="flex items-center justify-between">
                    <p className="hidden items-baseline gap-3 text-[22px] font-bold leading-4 text-text-accent lg:flex">
                      <span>{formatEth(nft.priceEth)}</span>
                      {nft.compareAtEth ? (
                        <s
                          aria-label={`Preço anterior ${formatEth(nft.compareAtEth)}`}
                          className="text-base font-normal text-kurio-secondary"
                        >
                          {formatEth(nft.compareAtEth)}
                        </s>
                      ) : null}
                    </p>
                    <Rating rating={nft.rating} />
                  </div>
                </div>
              </div>
              <img
                src={lineDetails}
                alt=""
                aria-hidden="true"
                className="hidden h-[0.3px] w-full lg:block"
              />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="hidden text-[15px] font-bold leading-4 text-foreground lg:block">
                Sobre este NFT:
              </h2>
              <p className="text-sm leading-6 text-text-secondary">{nft.description}</p>
            </div>

            <PurchaseBar key={nft.slug} nft={nft} />

            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-3 text-[15px] text-kurio-secondary">
                <li>ID do token: {nft.tokenId}</li>
                <li>Coleção: {nft.collectionName}</li>
                <li>Atributos: {nft.attributes.join(", ")}</li>
              </ul>
              <ShareLinks title={nft.title} />
            </div>
          </div>
        </div>
      </div>

      <Description nft={nft} />
      <RelatedNfts nft={nft} />
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div
      data-testid="nft-detail-skeleton"
      role="status"
      aria-label="Carregando NFT"
      className="flex min-h-[1600px] flex-col gap-12 pb-[220px] pt-4 lg:min-h-[1700px] lg:gap-24 lg:pb-12 lg:pt-6"
    >
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="skeleton h-[356px] w-full shrink-0 rounded-[24px] lg:h-[448px] lg:w-[573px]" />
        <div className="flex flex-1 flex-col gap-4 rounded-t-[31px] bg-surface-card px-6 pb-6 pt-8 lg:rounded-none lg:bg-transparent lg:p-0">
          <div className="skeleton h-8 w-2/3 rounded" />
          <div className="skeleton h-5 w-1/3 rounded" />
          <div className="skeleton h-24 w-full rounded" />
          <div className="skeleton h-14 w-full rounded" />
          <div className="skeleton h-20 w-full rounded" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="skeleton h-5 w-40 rounded" />
        <div className="skeleton h-32 w-full rounded" />
      </div>
      <div className="flex flex-col gap-6">
        <div className="skeleton h-5 w-48 rounded" />
        <div className="flex gap-6 overflow-hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="skeleton h-[256px] w-[180px] shrink-0 rounded-[20px] sm:h-[356px] sm:w-[258px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <section className="flex flex-col items-start gap-4 py-16">
      <h1 className="text-[28px] font-bold text-foreground">NFT não encontrado</h1>
      <p className="text-text-secondary">
        Não achamos nenhum NFT com este endereço. Ele pode ter sido removido.
      </p>
      <Link
        to="/"
        className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-bold text-ink transition-colors hover:bg-text-accent"
      >
        Voltar ao catálogo
      </Link>
    </section>
  );
}

export function DetailPage({ slug }: { slug: string }) {
  const query = useQuery(nftDetailQuery(slug));

  if (query.isPending) return <DetailSkeleton />;
  if (isNotFound(query.error)) return <NotFoundState />;
  if (query.isError) {
    return (
      <section role="alert" className="flex flex-col items-start gap-4 py-16">
        <h1 className="text-[28px] font-bold text-foreground">Não foi possível carregar o NFT</h1>
        <p className="text-text-secondary">{readApiError(query.error).message}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-bold text-ink transition-colors hover:bg-text-accent"
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  return <DetailContent nft={query.data} />;
}
