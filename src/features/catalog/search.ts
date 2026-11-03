import { z } from "zod";

export const COLLECTION_OPTIONS = [
  { id: "digital-art", label: "Arte digital" },
  { id: "photography", label: "Fotografia" },
  { id: "music", label: "Música" },
  { id: "3d", label: "Arte 3D" },
  { id: "collectibles", label: "Colecionáveis" },
  { id: "generative", label: "Generativa" },
  { id: "games", label: "Jogos" },
  { id: "subscriptions", label: "Assinaturas" },
  { id: "utility", label: "Utilidade" },
] as const;

export const NETWORK_OPTIONS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "polygon", label: "Polygon" },
  { id: "solana", label: "Solana" },
] as const;

export const SORT_OPTIONS = [
  { id: "recent", label: "Listados recentemente" },
  { id: "price_asc", label: "Menor preço" },
  { id: "price_desc", label: "Maior preço" },
  { id: "name", label: "Nome (A–Z)" },
] as const;

export const TAB_OPTIONS = [
  { id: "all", label: "Todos os NFTs" },
  { id: "new", label: "Novos lançamentos" },
  { id: "trending", label: "Em alta" },
] as const;

export const PAGE_SIZE = 9;
export const DEFAULT_MIN_PRICE = "0.02";
export const DEFAULT_MAX_PRICE = "12.30";

export type CollectionId = (typeof COLLECTION_OPTIONS)[number]["id"];
export type NetworkId = (typeof NETWORK_OPTIONS)[number]["id"];
export type SortId = (typeof SORT_OPTIONS)[number]["id"];
export type TabId = (typeof TAB_OPTIONS)[number]["id"];

const collectionIds: readonly string[] = COLLECTION_OPTIONS.map((option) => option.id);
const networkIds: readonly string[] = NETWORK_OPTIONS.map((option) => option.id);
const sortIds: readonly string[] = SORT_OPTIONS.map((option) => option.id);
const tabIds: readonly string[] = TAB_OPTIONS.map((option) => option.id);

const PRICE_PATTERN = /^\d{1,6}(\.\d{1,8})?$/;

function toList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => String(item));
}

/** Lista de ids conhecidos; repetidos e valores desconhecidos saem. `undefined` quando vazia. */
function allowedList<T extends string>(allowed: readonly string[]) {
  return z.preprocess(
    (value) => {
      const list = [...new Set(toList(value).filter((item) => allowed.includes(item)))];
      return list.length > 0 ? list : undefined;
    },
    z.array(z.custom<T>()).optional(),
  );
}

function allowedValue<T extends string>(allowed: readonly string[]) {
  return z.preprocess(
    (value) => {
      const [first] = toList(value);
      return first !== undefined && allowed.includes(first) ? first : undefined;
    },
    z.custom<T>().optional(),
  );
}

const priceField = z.preprocess((value) => {
  const [first] = toList(value);
  return first !== undefined && PRICE_PATTERN.test(first) ? first : undefined;
}, z.string().optional());

const pageField = z.preprocess((value) => {
  const [first] = toList(value);
  if (first === undefined || !/^\d+$/.test(first)) return undefined;
  const page = Number(first);
  return Number.isSafeInteger(page) && page >= 1 ? page : undefined;
}, z.number().int().min(1).optional());

const textField = z.preprocess((value) => {
  const [first] = toList(value);
  const text = first?.trim();
  return text ? text : undefined;
}, z.string().optional());

/**
 * Search da rota `/`. Todo campo é opcional: ausente significa o padrão
 * (página 1, aba "Todos", ordenação recente, sem filtro). Valores inválidos
 * viram `undefined` em vez de quebrar a rota.
 */
export const catalogSearchSchema = z.object({
  q: textField,
  collection: allowedList<CollectionId>(collectionIds),
  network: allowedList<NetworkId>(networkIds),
  minPrice: priceField,
  maxPrice: priceField,
  sort: allowedValue<SortId>(sortIds),
  tab: allowedValue<TabId>(tabIds),
  page: pageField,
});

export type CatalogSearch = z.infer<typeof catalogSearchSchema>;

/** Parâmetros completos da requisição, com padrões aplicados. Entram inteiros no `queryKey`. */
export type CatalogParams = {
  q: string;
  collection: CollectionId[];
  network: NetworkId[];
  minPrice: string | null;
  maxPrice: string | null;
  sort: SortId;
  tab: TabId;
  page: number;
  pageSize: number;
};

export function toParams(search: CatalogSearch): CatalogParams {
  return {
    q: search.q ?? "",
    collection: search.collection ?? [],
    network: search.network ?? [],
    minPrice: search.minPrice ?? null,
    maxPrice: search.maxPrice ?? null,
    sort: search.sort ?? "recent",
    tab: search.tab ?? "all",
    page: search.page ?? 1,
    pageSize: PAGE_SIZE,
  };
}

/**
 * Muda um ou mais filtros e volta para a página 1. Para trocar de página use
 * `withPage`, que não mexe nos filtros.
 */
export function withFilter(search: CatalogSearch, patch: Partial<CatalogSearch>): CatalogSearch {
  return { ...search, ...patch, page: 1 };
}

export function withPage(search: CatalogSearch, page: number): CatalogSearch {
  return { ...search, page };
}

function isEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

/** Tira da URL o que é padrão ou vazio, para o link ficar curto e estável. */
export function cleanSearch(search: CatalogSearch): CatalogSearch {
  const next: CatalogSearch = { ...search };
  if (next.page === 1) delete next.page;
  if (next.sort === "recent") delete next.sort;
  if (next.tab === "all") delete next.tab;
  for (const key of Object.keys(next) as (keyof CatalogSearch)[]) {
    if (next[key] === undefined || next[key] === "" || isEmptyList(next[key])) delete next[key];
  }
  return next;
}

export type RawSearch = Record<string, string | string[]>;

/** `?a=1&a=2&b=3` -> `{ a: ["1", "2"], b: "3" }`. Sem JSON: cada valor é texto. */
export function parseSearchString(search: string): RawSearch {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const result: RawSearch = Object.create(null);
  params.forEach((_, key) => {
    if (key in result) return;
    const values = params.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  });
  return result;
}

/** Inverso de `parseSearchString`: listas viram parâmetros repetidos. */
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === "") continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, String(item));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
