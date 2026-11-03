import Decimal from "decimal.js";
import { delay, http, HttpResponse } from "msw";
import {
  COLLECTION_OPTIONS,
  NETWORK_OPTIONS,
  PAGE_SIZE,
} from "@/features/catalog/search";
import type { NftSummary } from "@/shared/domain/contracts";
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
];
