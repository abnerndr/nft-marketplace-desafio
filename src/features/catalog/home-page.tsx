import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import arrowDown from "@/assets/home/arrow-down.svg";
import arrowRight from "@/assets/home/arrow-right.svg";
import artDark from "@/assets/home/art-dark.png";
import artOrange from "@/assets/home/art-orange.png";
import artPurple from "@/assets/home/art-purple.png";
import filterIcon from "@/assets/home/filter.svg";
import heroArt from "@/assets/home/hero-art.png";
import heroBg from "@/assets/home/hero-bg.svg";
import heroDots from "@/assets/home/hero-dots.svg";
import pageNext from "@/assets/home/page-next.svg";
import promoMask from "@/assets/home/promo-mask.svg";
import tabUnderline from "@/assets/home/tab-underline.svg";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { readApiError } from "@/shared/api/errors";
import { nftListQuery } from "./api";
import { Filters } from "./filters";
import { NftCard, NftCardSkeleton } from "./nft-card";
import {
  cleanSearch,
  PAGE_SIZE,
  SORT_OPTIONS,
  TAB_OPTIONS,
  toParams,
  withFilter,
  withPage,
  type CatalogSearch,
  type SortId,
  type TabId,
} from "./search";

const primaryButton =
  "items-center justify-center rounded-md bg-primary font-bold text-ink transition-colors hover:bg-text-accent";

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex flex-col justify-center overflow-hidden rounded-[30px] bg-surface-card p-4 lg:h-[450px] lg:rounded-none lg:px-10 lg:py-0"
    >
      <img
        src={heroBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full max-w-none"
      />
      <div className="relative flex items-center justify-between gap-2 lg:gap-10">
        <div className="flex min-w-0 flex-col gap-4 lg:w-[600px] lg:gap-11">
          <div className="flex flex-col gap-4 lg:gap-8">
            <div className="flex flex-col gap-1.5 lg:gap-1">
              <div className="flex flex-col gap-1.5 text-foreground lg:gap-2">
                <p className="text-xs font-medium leading-4 lg:text-sm lg:tracking-[0.1em]">
                  Bem-vindo à Kurio
                </p>
                <h1 id="hero-title" className="text-lg font-bold lg:text-[43px]">
                  <span className="block leading-[29px] lg:hidden">SEJA DONO DA</span>
                  <span className="block leading-[29px] lg:hidden">CULTURA DIGITAL</span>
                  <span className="hidden leading-[70px] lg:block">SEJA DONO DO FUTURO</span>
                  <span className="hidden leading-[70px] lg:block">DA ARTE DIGITAL</span>
                </h1>
              </div>
              <p className="text-xs leading-[18px] text-text-secondary lg:hidden">
                Descubra NFTs selecionados de criadores do mundo todo.
              </p>
              <p className="hidden max-w-[557px] text-sm leading-6 text-text-secondary lg:block">
                Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte
                digital rara, apoie artistas e tenha uma parte da cultura da internet.
              </p>
            </div>
            <Link
              to="/"
              hash="catalogo"
              search={(prev) => prev}
              className={`${primaryButton} hidden h-10 w-[140px] text-base lg:inline-flex`}
            >
              EXPLORAR
            </Link>
            <Link
              to="/"
              hash="catalogo"
              search={(prev) => prev}
              className="flex items-center gap-2 text-xs font-bold leading-[14px] text-text-accent lg:hidden"
            >
              EXPLORAR
              <img
                src={arrowRight}
                alt=""
                width={11}
                height={13}
                className="-rotate-90 brightness-0 invert-[0.6] sepia saturate-[3] hue-rotate-[345deg]"
              />
            </Link>
          </div>
          <img
            src={heroDots}
            alt=""
            aria-hidden="true"
            width={40}
            height={8}
            className="hidden lg:block lg:self-end"
          />
        </div>
        <div className="relative size-[138px] shrink-0 lg:size-[450px]">
          <img
            src={heroArt}
            alt="Macaco de óculos e jaqueta verde, arte em destaque"
            className="size-full rounded-2xl object-cover lg:rounded-3xl"
          />
          <img
            src={artPurple}
            alt=""
            aria-hidden="true"
            className="absolute left-3.5 top-[88px] size-[58px] rounded-2xl object-cover lg:hidden"
          />
        </div>
      </div>
    </section>
  );
}

function Tabs({ value, onChange }: { value: TabId; onChange: (tab: TabId) => void }) {
  return (
    <div role="tablist" aria-label="Seções do catálogo" className="flex flex-wrap gap-x-5 gap-y-2">
      {TAB_OPTIONS.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls="catalogo-grade"
            onClick={() => onChange(tab.id)}
            className={`flex flex-col gap-1 text-sm font-medium leading-4 sm:text-[15px] ${
              selected ? "text-text-accent" : "text-foreground hover:text-text-accent"
            }`}
          >
            {tab.label}
            {selected ? <img src={tabUnderline} alt="" className="h-0.5 w-full" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function SortSelect({ value, onChange }: { value: SortId; onChange: (sort: SortId) => void }) {
  return (
    <label className="relative flex items-center gap-3 text-[15px] text-foreground">
      Ordenar por:
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortId)}
        className="cursor-pointer appearance-none bg-transparent pr-6 text-[15px] text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id} className="bg-ink">
            {option.label}
          </option>
        ))}
      </select>
      <img
        src={arrowDown}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/2 w-[11px] -translate-y-1/2"
      />
    </label>
  );
}

function pageWindow(page: number, pages: number): number[] {
  const size = Math.min(4, pages);
  const first = Math.max(1, Math.min(page - 1, pages - size + 1));
  return Array.from({ length: size }, (_, index) => first + index);
}

function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const box = "flex size-[35px] items-center justify-center rounded border";
  return (
    <nav aria-label="Paginação" className="flex items-center gap-2 self-end">
      {page > 1 ? (
        <button
          type="button"
          aria-label="Página anterior"
          onClick={() => onChange(page - 1)}
          className={`${box} border-border`}
        >
          <img src={pageNext} alt="" width={12} height={7} className="rotate-90" />
        </button>
      ) : null}
      {pageWindow(page, pages).map((number) => (
        <button
          key={number}
          type="button"
          aria-label={`Página ${number}`}
          aria-current={number === page ? "page" : undefined}
          onClick={() => onChange(number)}
          className={
            number === page
              ? `${box} border-primary bg-primary text-lg font-bold text-ink`
              : `${box} border-border text-lg text-foreground hover:border-primary`
          }
        >
          {number}
        </button>
      ))}
      {page < pages ? (
        <button
          type="button"
          aria-label="Próxima página"
          onClick={() => onChange(page + 1)}
          className={`${box} border-border`}
        >
          <img src={pageNext} alt="" width={12} height={7} className="-rotate-90" />
        </button>
      ) : null}
    </nav>
  );
}

const GRID =
  "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,258px)] sm:justify-between sm:gap-y-[72px]";

function hasFilters(search: CatalogSearch): boolean {
  return Boolean(
    search.q ||
      search.collection ||
      search.network ||
      search.minPrice ||
      search.maxPrice ||
      (search.tab && search.tab !== "all"),
  );
}

function Catalog() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = toParams(search);
  const query = useQuery(nftListQuery(params));

  function go(next: CatalogSearch, scrollToCatalog = false) {
    void navigate({
      search: cleanSearch(next),
      hash: scrollToCatalog ? "catalogo" : undefined,
      resetScroll: false,
    });
  }

  const change = (patch: Partial<CatalogSearch>) => go(withFilter(search, patch));
  const clearFilters = () => go({ sort: search.sort });

  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  let content;
  if (query.isPending) {
    content = (
      <div className={GRID} aria-busy="true">
        {Array.from({ length: PAGE_SIZE }, (_, index) => (
          <NftCardSkeleton key={index} />
        ))}
      </div>
    );
  } else if (query.isError) {
    content = (
      <div
        role="alert"
        className="flex flex-col items-start gap-4 border border-border-soft bg-surface-card p-6"
      >
        <p className="text-foreground">
          Não foi possível carregar os NFTs. {readApiError(query.error).message}
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className={`${primaryButton} inline-flex h-10 px-4 text-base disabled:opacity-60`}
        >
          {query.isFetching ? "Carregando…" : "Tentar novamente"}
        </button>
      </div>
    );
  } else if (query.data.items.length === 0) {
    content = (
      <div className="flex flex-col items-start gap-4 bg-surface-card p-6">
        <p className="text-foreground">Nenhum NFT encontrado para esta busca.</p>
        {hasFilters(search) || (search.page ?? 1) > 1 ? (
          <button
            type="button"
            onClick={clearFilters}
            className={`${primaryButton} inline-flex h-10 px-4 text-base`}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
    );
  } else {
    content = (
      <>
        <div className={GRID}>
          {query.data.items.map((nft) => (
            <NftCard key={nft.id} nft={nft} />
          ))}
        </div>
        <Pagination
          page={query.data.page}
          pages={pages}
          onChange={(page) => go(withPage(search, page), true)}
        />
      </>
    );
  }

  return (
    <section
      id="catalogo"
      aria-label="Catálogo de NFTs"
      className="flex scroll-mt-6 flex-col gap-6 lg:flex-row lg:gap-12"
    >
      <aside className="flex flex-col gap-6 lg:w-[310px] lg:shrink-0">
        <Button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="catalogo-filtros-mobile"
          className="h-11 gap-2 rounded-[14px] bg-gradient-to-br from-primary/45 to-primary lg:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <img src={filterIcon} alt="" width={16} height={16} />
          Filtros
        </Button>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen} modal={false}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[20px] lg:hidden">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div id="catalogo-filtros-mobile" className="mt-4">
              <Filters search={search} facets={data?.facets} onChange={change} />
            </div>
          </SheetContent>
        </Sheet>
        <div id="catalogo-filtros" className="hidden lg:block">
          <Filters search={search} facets={data?.facets} onChange={change} />
        </div>
        <div className="relative hidden h-[470px] flex-col gap-4 overflow-hidden bg-gradient-to-b from-primary/10 to-primary/[0.03] pt-6 lg:flex">
          <p className="px-5 text-2xl font-bold leading-8 text-text-accent">NFT EM DESTAQUE</p>
          <p className="px-5 text-center text-[22px] font-bold leading-4 text-foreground">
            OFERTA LIMITADA
          </p>
          <img
            src={artPurple}
            alt="Macaco com chapéu verde e moletom roxo"
            className="mt-0 h-[368px] w-full rounded-[22px] object-cover"
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs value={params.tab} onChange={(tab) => change({ tab })} />
          <SortSelect value={params.sort} onChange={(sort) => change({ sort })} />
        </div>
        <p role="status" className="sr-only">
          {data ? `${data.total} NFTs encontrados` : "Carregando NFTs"}
        </p>
        <div
          id="catalogo-grade"
          role="tabpanel"
          aria-labelledby={`tab-${params.tab}`}
          className="flex flex-col gap-12"
        >
          {content}
        </div>
      </div>
    </section>
  );
}

type PromoProps = {
  title: [string, string];
  text: string;
  image: string;
  imageAlt: string;
  search: CatalogSearch;
};

function Promo({ title, text, image, imageAlt, search }: PromoProps) {
  return (
    <article className="relative flex min-h-[250px] flex-col overflow-hidden rounded-lg bg-surface-card lg:flex-row lg:items-center">
      <img
        src={promoMask}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full max-w-none"
      />
      <img
        src={image}
        alt={imageAlt}
        className="relative h-[250px] w-full rounded-[18px] object-cover lg:-ml-1 lg:w-[292px] lg:shrink-0"
      />
      <div className="relative flex flex-1 flex-col items-start gap-4 p-5 lg:items-end lg:pr-[30px] lg:text-right">
        <h2 className="text-lg font-bold leading-6 text-foreground">
          {title[0]}
          <br />
          {title[1]}
        </h2>
        <p className="max-w-[263px] text-sm leading-6 text-text-secondary">{text}</p>
        <Link
          to="/"
          search={search}
          hash="catalogo"
          className={`${primaryButton} inline-flex h-10 w-[140px] gap-2 text-sm font-medium`}
        >
          Explorar
          <img src={arrowRight} alt="" width={11} height={13} className="-rotate-90" />
        </Link>
      </div>
    </article>
  );
}

function Promos() {
  return (
    <section aria-label="Destaques" className="grid gap-6 md:grid-cols-2">
      <Promo
        title={["Lançamentos gênesis", "de edição limitada"]}
        text="Colecione edições escassas diretamente dos criadores antes da revelação pública."
        image={heroArt}
        imageAlt="Macaco de óculos e jaqueta verde"
        search={{ tab: "new" }}
      />
      <Promo
        title={["Arte digital selecionada", "e muito mais"]}
        text="Explore novos artistas, coleções verificadas e obras digitais que definem a cultura."
        image={artDark}
        imageAlt="Macaco de terno claro"
        search={{ collection: ["digital-art"] }}
      />
    </section>
  );
}

const posts = [
  {
    image: artDark,
    meta: "12 de setembro  |  Leitura de 6 min",
    title: "Como funciona a propriedade de NFTs",
    text: "Aprenda a colecionar, negociar e verificar ativos digitais.",
  },
  {
    image: heroArt,
    meta: "13 de setembro  |  Leitura de 2 min",
    title: "10 artistas digitais para acompanhar",
    text: "Conheça criadores que moldam a cultura digital.",
  },
  {
    image: artPurple,
    meta: "15 de setembro  |  Leitura de 3 min",
    title: "Raridade, atributos e procedência",
    text: "Entenda raridade, procedência, direitos autorais e utilidade.",
  },
  {
    image: artOrange,
    meta: "15 de setembro  |  Leitura de 2 min",
    title: "Como proteger sua carteira",
    text: "Proteja sua carteira, seus ativos e sua identidade.",
  },
];

function Diary() {
  return (
    <section id="diario" aria-labelledby="diario-titulo" className="flex scroll-mt-6 flex-col items-center gap-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <h2 id="diario-titulo" className="text-[28px] font-bold text-text-primary">
          Diário da Cunhagem
        </h2>
        <p className="text-sm text-text-secondary">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </header>
      <ul className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((post) => (
          <li key={post.title} className="flex flex-col overflow-hidden rounded-lg bg-surface-card">
            <img src={post.image} alt="" className="h-[195px] w-full object-cover" />
            <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
              <p className="whitespace-pre-wrap text-xs font-medium leading-4 text-text-secondary">
                {post.meta}
              </p>
              <h3 className="text-base font-bold text-text-primary">{post.title}</h3>
              <p className="text-xs font-medium leading-4 text-text-secondary">{post.text}</p>
              <p className="flex gap-1 text-xs text-text-accent">
                <span className="font-bold leading-[14px]">Ler mais</span>
                <span aria-hidden="true">→</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomePage() {
  return (
    <div className="flex flex-col gap-16 py-6 lg:gap-24">
      <Hero />
      <Catalog />
      <Promos />
      <Diary />
    </div>
  );
}
