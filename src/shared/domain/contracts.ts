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

export const editionSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Unidades que ainda podem ser compradas. Zero desabilita a edição. */
  available: z.number().int().nonnegative(),
});

export const nftDetailSchema = z.object({
  ...nftFields,
  tokenId: z.string(),
  collectionName: z.string(),
  description: z.string(),
  about: z.array(z.string()),
  attributes: z.array(z.string()),
  networkNote: z.string(),
  royaltyNote: z.string(),
  contractNote: z.string(),
  rating: z.object({ average: z.string(), count: z.number().int().nonnegative() }),
  editions: z.array(editionSchema),
});

export const cartItemSchema = z.object({
  slug: z.string(),
  editionId: z.string(),
  quantity: z.number().int().positive(),
});

/** Linha do carrinho como `GET /api/cart` devolve: item mais os dados para exibir. */
export const cartLineSchema = cartItemSchema.extend({
  id: z.string(),
  editionLabel: z.string(),
  /** Estoque atual da edição; limita o stepper. */
  available: z.number().int().nonnegative(),
  title: z.string(),
  tokenId: z.string(),
  imageUrl: z.string(),
  priceEth: z.string(),
});

export const cartViewSchema = z.object({
  items: z.array(cartLineSchema),
  couponCode: z.string().nullable(),
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

/** Linha gravada no pedido: a tela de recibo lê daqui, nunca do catálogo ao vivo. */
export const orderItemSchema = z.object({
  slug: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  quantity: z.number().int().positive(),
  title: z.string(),
  tokenId: z.string(),
  imageUrl: z.string(),
  priceEth: z.string(),
});

/** Cotação mais itens e cupom, como estavam na criação do pedido. */
export const orderSnapshotSchema = quoteSchema.extend({
  items: z.array(orderItemSchema),
  couponCode: z.string().nullable(),
});

export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  snapshot: orderSnapshotSchema,
  txRef: z.string().nullable(),
  wallet: z.object({ label: z.string(), address: z.string(), network: z.string() }),
  createdAt: z.string(),
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
export type Edition = z.infer<typeof editionSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type CartLine = z.infer<typeof cartLineSchema>;
export type CartView = z.infer<typeof cartViewSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type User = z.infer<typeof userSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
