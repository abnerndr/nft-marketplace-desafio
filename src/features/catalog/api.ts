import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/shared/api/client";
import { nftSummarySchema } from "@/shared/domain/contracts";
import type { CatalogParams } from "./search";

const countsSchema = z.record(z.string(), z.number().int().nonnegative());

export const nftListSchema = z.object({
  items: z.array(nftSummarySchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  facets: z.object({
    collection: countsSchema,
    network: countsSchema,
  }),
});

export type NftList = z.infer<typeof nftListSchema>;

export async function fetchNfts(params: CatalogParams, signal?: AbortSignal): Promise<NftList> {
  const response = await api.get("/nfts", {
    signal,
    // Listas viram parâmetros repetidos: collection=a&collection=b.
    paramsSerializer: { indexes: null },
    params: {
      q: params.q || undefined,
      collection: params.collection.length > 0 ? params.collection : undefined,
      network: params.network.length > 0 ? params.network : undefined,
      minPrice: params.minPrice ?? undefined,
      maxPrice: params.maxPrice ?? undefined,
      sort: params.sort,
      tab: params.tab,
      page: params.page,
      pageSize: params.pageSize,
    },
  });
  return nftListSchema.parse(response.data);
}

/**
 * O `queryKey` leva todos os parâmetros: uma resposta atrasada de uma busca
 * antiga cai no cache da key antiga e nunca substitui a lista atual.
 */
export function nftListQuery(params: CatalogParams) {
  return queryOptions({
    queryKey: ["nfts", params] as const,
    queryFn: ({ signal }) => fetchNfts(params, signal),
  });
}
