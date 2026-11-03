import Decimal from "decimal.js";
import { delay, http, HttpResponse } from "msw";
import {
  COLLECTION_OPTIONS,
  NETWORK_OPTIONS,
  PAGE_SIZE,
} from "@/features/catalog/search";
import type { Edition, NftDetail, NftSummary } from "@/shared/domain/contracts";
import { getDatabase } from "../db";
import { getScenario, nextOutOfOrderDelay, shouldFailTransient } from "../scenarios";

const MAX_PAGE_SIZE = 48;
/** Quantos itens, do mais recente para trás, contam como "Novos lançamentos". */
const NEW_RELEASES = 12;
/** "Em alta": edições escassas, com poucas unidades restantes. */
const TRENDING_MAX_AVAILABLE = 3;

type Filters = {
  q: string;
  collection: string[];
  network: string[];
  minPrice: Decimal | null;
  maxPrice: Decimal | null;
  tab: string;
};

function readDecimal(value: string | null): Decimal | null {
  if (value === null || value.trim() === "") return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function readPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function matches(
  nft: NftSummary,
  position: number,
  filters: Filters,
  skip?: "collection" | "network",
): boolean {
  if (filters.q && !normalize(nft.title).includes(normalize(filters.q))) return false;
  if (skip !== "collection" && filters.collection.length > 0 && !filters.collection.includes(nft.collection)) {
    return false;
  }
  if (skip !== "network" && filters.network.length > 0 && !filters.network.includes(nft.network)) {
    return false;
  }
  const price = new Decimal(nft.priceEth);
  if (filters.minPrice && price.lessThan(filters.minPrice)) return false;
  if (filters.maxPrice && price.greaterThan(filters.maxPrice)) return false;
  if (filters.tab === "new" && position >= NEW_RELEASES) return false;
  if (filters.tab === "trending" && nft.available > TRENDING_MAX_AVAILABLE) return false;
  return true;
}

function sortItems(items: NftSummary[], sort: string): NftSummary[] {
  const sorted = [...items];
  if (sort === "price_asc") {
    sorted.sort((a, b) => new Decimal(a.priceEth).comparedTo(b.priceEth));
  } else if (sort === "price_desc") {
    sorted.sort((a, b) => new Decimal(b.priceEth).comparedTo(a.priceEth));
  } else if (sort === "name") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }
  // "recent" mantém a ordem do seed: o primeiro item é o mais recente.
  return sorted;
}

function emptyFacets() {
  return {
    collection: Object.fromEntries(COLLECTION_OPTIONS.map((option) => [option.id, 0])),
    network: Object.fromEntries(NETWORK_OPTIONS.map((option) => [option.id, 0])),
  };
}

const NETWORK_NOTES: Record<string, string> = {
  ethereum: "Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS.",
  polygon: "Cunhado na Polygon com procedência imutável e metadados armazenados no IPFS.",
  solana: "Cunhado na Solana com procedência imutável e metadados armazenados no IPFS.",
};

const ACCESSORIES = ["Óculos", "Chapéu", "Fones", "Colar"];
const PALETTES = ["Esmeralda", "Violeta", "Âmbar", "Marfim", "Cobalto"];
const RARITIES = ["Comum", "Raro", "Épico"];
/** O frame mostra estes atributos para o slug de exemplo. */
const FIXED_ATTRIBUTES: Record<string, string[]> = {
  "emerald-ape-042": ["Óculos", "Esmeralda", "Raro"],
};

function tokenNumber(slug: string): number {
  const match = slug.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

/**
 * Edições de um NFT, derivadas só do `available` do resumo: a regra fica num lugar
 * e o carrinho valida contra a mesma lista. `1/1` é sempre a edição esgotada.
 */
export function editionsOf(nft: NftSummary): Edition[] {
  return [
    { id: "ed-1-1", label: "1/1", available: 0 },
    { id: "ed-1-10", label: "1/10", available: Math.floor(nft.available / 2) },
    { id: "ed-1-50", label: "1/50", available: nft.available },
    { id: "ed-open", label: "ABERTA", available: nft.available },
  ];
}

/** "emerald-ape-042" vira "#0042". */
export function tokenIdOf(slug: string): string {
  return `#${String(tokenNumber(slug)).padStart(4, "0")}`;
}

export function findNftBySlug(slug: string): NftSummary | undefined {
  return getDatabase().nfts.find((nft) => nft.slug === slug);
}

/** "Emerald Ape #042" vira "Kurio Apes": a última palavra do nome, no plural. */
function collectionNameOf(title: string): string {
  const words = title.replace(/\s*#\d+$/, "").split(" ");
  return `Kurio ${words[words.length - 1]}s`;
}

function toDetail(nft: NftSummary): NftDetail {
  const number = tokenNumber(nft.slug);
  const attributes = FIXED_ATTRIBUTES[nft.slug] ?? [
    ACCESSORIES[number % ACCESSORIES.length],
    PALETTES[number % PALETTES.length],
    RARITIES[number % RARITIES.length],
  ];
  return {
    ...nft,
    collectionName: collectionNameOf(nft.title),
    tokenId: tokenIdOf(nft.slug),
    description:
      "Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.",
    about: [
      `${nft.title} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      "A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.",
    ],
    attributes,
    networkNote: NETWORK_NOTES[nft.network] ?? NETWORK_NOTES.ethereum,
    royaltyNote:
      "Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.",
    contractNote: "0x7A42...19E8 • Contrato inteligente ERC-721 verificado.",
    rating: { average: "4.8", count: 19 },
    editions: editionsOf(nft),
  };
}

export const nftHandlers = [
  http.get("/api/nfts", async ({ request }) => {
    if (shouldFailTransient(request.url)) {
      return HttpResponse.json(
        { error: { code: "unavailable", message: "Serviço indisponível. Tente novamente." } },
        { status: 503 },
      );
    }

    // out-of-order: cada busca espera menos que a anterior, então a mais nova pode chegar antes.
    const wait = nextOutOfOrderDelay();
    if (wait > 0) await delay(wait);

    const url = new URL(request.url);
    const search = url.searchParams;
    const page = readPositiveInt(search.get("page"), 1);
    const pageSize = Math.min(readPositiveInt(search.get("pageSize"), PAGE_SIZE), MAX_PAGE_SIZE);

    if (getScenario() === "empty") {
      return HttpResponse.json({ items: [], page, pageSize, total: 0, facets: emptyFacets() });
    }

    const filters: Filters = {
      q: (search.get("q") ?? "").trim(),
      collection: search.getAll("collection"),
      network: search.getAll("network"),
      minPrice: readDecimal(search.get("minPrice")),
      maxPrice: readDecimal(search.get("maxPrice")),
      tab: search.get("tab") ?? "all",
    };

    const all = getDatabase().nfts;
    const positions = new Map(all.map((nft, index) => [nft.id, index]));
    const position = (nft: NftSummary) => positions.get(nft.id) ?? 0;

    const filtered = all.filter((nft) => matches(nft, position(nft), filters));
    const sorted = sortItems(filtered, search.get("sort") ?? "recent");
    const start = (page - 1) * pageSize;

    // Contagem de cada filtro depois de aplicar todos os outros.
    const facets = emptyFacets();
    for (const nft of all) {
      if (matches(nft, position(nft), filters, "collection")) {
        facets.collection[nft.collection] = (facets.collection[nft.collection] ?? 0) + 1;
      }
      if (matches(nft, position(nft), filters, "network")) {
        facets.network[nft.network] = (facets.network[nft.network] ?? 0) + 1;
      }
    }

    return HttpResponse.json({
      items: sorted.slice(start, start + pageSize),
      page,
      pageSize,
      total: sorted.length,
      facets,
    });
  }),
  http.get("/api/nfts/:slug", ({ request, params }) => {
    if (shouldFailTransient(request.url)) {
      return HttpResponse.json(
        { error: { code: "unavailable", message: "Serviço indisponível. Tente novamente." } },
        { status: 503 },
      );
    }

    const nft = findNftBySlug(String(params.slug));
    if (!nft) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "NFT não encontrado." } },
        { status: 404 },
      );
    }
    return HttpResponse.json(toDetail(nft));
  }),
];
