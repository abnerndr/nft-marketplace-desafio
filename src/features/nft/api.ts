import { isAxiosError } from "axios";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { cartItemSchema, nftDetailSchema } from "@/shared/domain/contracts";
import { z } from "zod";

export function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}

export function isUnauthorized(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401;
}

export function nftDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["nft", slug] as const,
    queryFn: async ({ signal }) => {
      const { data } = await api.get(`/nfts/${encodeURIComponent(slug)}`, { signal });
      return nftDetailSchema.parse(data);
    },
    // Um 404 não melhora com nova tentativa.
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

export type AddToCartInput = { slug: string; editionId: string; quantity: number };

const addToCartResponseSchema = z.object({ item: cartItemSchema });

export async function addToCart(input: AddToCartInput) {
  const { data } = await api.post("/cart/items", input);
  return addToCartResponseSchema.parse(data).item;
}
