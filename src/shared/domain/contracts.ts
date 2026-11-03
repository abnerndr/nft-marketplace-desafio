import { z } from "zod";

const nftFields = {
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  collection: z.string(),
  network: z.string(),
  priceEth: z.string(),
  compareAtEth: z.string().nullable(),
  available: z.number().int().nonnegative(),
  imageUrl: z.string(),
};

export const nftSummarySchema = z.object(nftFields);

export const nftDetailSchema = z.object(nftFields);

export const cartItemSchema = z.object({
  slug: z.string(),
  editionId: z.string(),
  quantity: z.number().int().positive(),
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  couponCode: z.string().nullable(),
});

export const quoteSchema = z.object({
  subtotalEth: z.string(),
  discountEth: z.string(),
  networkFeeEth: z.string(),
  totalEth: z.string(),
  version: z.number().int(),
});

export const orderStatusSchema = z.enum(["pending", "confirmed", "declined"]);

export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  snapshot: quoteSchema,
  txRef: z.string().nullable(),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
});

export type NftSummary = z.infer<typeof nftSummarySchema>;
export type NftDetail = z.infer<typeof nftDetailSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Order = z.infer<typeof orderSchema>;
export type User = z.infer<typeof userSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
