import type { Cart, NftSummary, Order, User } from "@/shared/domain/contracts";
import { resolveNftAsset } from "@/shared/domain/nft-assets";

/**
 * Versão do seed persistido. Subir quando o formato/arte do seed mudar
 * (ex.: troca de placeholders `/nfts/*.svg` por PNGs do Figma) para invalidar `kurio.mock`.
 */
export const SEED_VERSION = 6;

/** Campos de perfil são opcionais: o seed e bancos antigos não os têm. */
export type UserRecord = User & {
	passwordHash: string;
	username?: string;
	ens?: string;
	walletNickname?: string;
	/** Data URL da imagem enviada em `POST /api/profile/avatar`. */
	avatarUrl?: string;
};

export type Wallet = {
	id: string;
	label: string;
	address: string;
	network: "ethereum" | "polygon" | "solana";
	/** Ausente nas carteiras do seed: vale `metamask`. */
	provider?: "metamask" | "walletconnect" | "coinbase";
	/** Ausente nas carteiras do seed: vale `false`. */
	connected?: boolean;
	/** Ausente nas carteiras do seed: a primeira da lista vale como principal. */
	primary?: boolean;
	/** Campos opcionais do formulário de carteiras. */
	alias?: string;
	profileName?: string;
	secondaryAddress?: string;
	referralCode?: string;
	email?: string;
	ens?: string;
};

/** Pedido como o mock guarda: o contrato público mais o dono e a carteira usada. */
export type OrderRecord = Order & {
	userId: string;
	walletId: string;
	/** Leituras de `GET /api/orders/:id` enquanto pendente (cenário `order-timeout`). */
	reads: number;
};

/** Pedido criado com uma chave de idempotência: corpo cru e pedido resultante. */
export type IdempotencyRecord = { body: string; orderId: string };

/** Saldo persistido por edição (`slug::editionId` na chave do mapa). */
export type EditionStockRecord = {
	slug: string;
	editionId: string;
	remaining: number;
	version: number;
};

/** Reserva de estoque ligada a um pedido: reserved baixa saldo; committed não reaplica. */
export type InventoryReservation = {
	lines: Array<{ slug: string; editionId: string; quantity: number }>;
	state: "reserved" | "committed";
};

export type Database = {
	nfts: NftSummary[];
	users: UserRecord[];
	carts: Record<string, Cart>;
	orders: OrderRecord[];
	/** `${userId}:${Idempotency-Key}` -> tentativa. Ausente em bancos gravados antes desta task. */
	idempotency?: Record<string, IdempotencyRecord>;
	favorites: Record<string, string[]>;
	wallets: Record<string, Wallet[]>;
	/** token opaco -> id do usuário. */
	sessions: Record<string, string>;
	/** Usuários que já receberam a mudança de preço do cenário `price-changed` (uma por sessão). */
	priceChangedFor?: string[];
	/**
	 * Estoque por edição. Ausente em bancos antigos: `inventory.ensure` reconstrói a partir de
	 * `nft.available` no próximo acesso (reset/`?reset=1` garante seed limpo na demonstração).
	 */
	editionStock?: Record<string, EditionStockRecord>;
	/** Reservas por `orderId`. */
	reservations?: Record<string, InventoryReservation>;
	/** Resultado idempotente de `POST /cart/merge` por `${userId}:${mergeId}`. */
	cartMerges?: Record<string, { cart: Cart; adjustments: Array<{ slug: string; editionId: string; from: number; to: number; reason: string }> }>;
};

type Collection = "digital-art" | "photography" | "music" | "3d" | "collectibles" | "generative" | "games" | "subscriptions" | "utility";

type Network = "ethereum" | "polygon" | "solana";

type Named = {
	title: string;
	slug: string;
	collection: Collection;
	network: Network;
	cents: number;
	compareAtEth: string | null;
	available: number;
};

// Os 8 títulos visíveis na home, com os preços do frame.
const NAMED: Named[] = [
	{ title: "Emerald Ape #042", slug: "emerald-ape-042", collection: "digital-art", network: "ethereum", cents: 119, compareAtEth: null, available: 5 },
	{ title: "Sage Nomad #009", slug: "sage-nomad-009", collection: "digital-art", network: "polygon", cents: 169, compareAtEth: null, available: 4 },
	{ title: "Neon Vessel #552", slug: "neon-vessel-552", collection: "3d", network: "ethereum", cents: 199, compareAtEth: "2.29", available: 3 },
	{ title: "Cosmic Bloom #118", slug: "cosmic-bloom-118", collection: "generative", network: "solana", cents: 129, compareAtEth: null, available: 6 },
	{ title: "Violet Nomad #314", slug: "violet-nomad-314", collection: "digital-art", network: "ethereum", cents: 139, compareAtEth: null, available: 2 },
	{ title: "Ivory Baron #088", slug: "ivory-baron-088", collection: "collectibles", network: "polygon", cents: 179, compareAtEth: null, available: 7 },
	{ title: "Golden Beat #207", slug: "golden-beat-207", collection: "music", network: "ethereum", cents: 99, compareAtEth: null, available: 8 },
	{ title: "Golden Signal #160", slug: "golden-signal-160", collection: "utility", network: "solana", cents: 39, compareAtEth: null, available: 10 },
];

const COLLECTIONS: Collection[] = ["digital-art", "photography", "music", "3d", "collectibles", "generative", "games", "subscriptions", "utility"];
const NETWORKS: Network[] = ["ethereum", "polygon", "solana"];

const TOTAL_NFTS = 36;

function toEth(cents: number): string {
	return (cents / 100).toFixed(2);
}

function toNft(slug: string, title: string, collection: Collection, network: Network, cents: number, compareAtEth: string | null, available: number, image: string): NftSummary {
	return {
		id: `nft-${slug}`,
		slug,
		title,
		collection,
		network,
		priceEth: toEth(cents),
		compareAtEth,
		available,
		imageUrl: resolveNftAsset(image),
	};
}

function createNfts(): NftSummary[] {
	const nfts = NAMED.map((n) => toNft(n.slug, n.title, n.collection, n.network, n.cents, n.compareAtEth, n.available, n.slug));

	// Variantes determinísticas: reaproveitam o nome e a imagem de um dos 8 títulos.
	const variants = TOTAL_NFTS - NAMED.length;
	for (let i = 0; i < variants; i++) {
		const base = NAMED[i % NAMED.length];
		const baseNumber = Number(base.slug.slice(-3));
		const number = String(baseNumber + 100 + Math.floor(i / NAMED.length) * 7 + i).padStart(3, "0");
		const name = base.title.replace(/ #\d+$/, "");
		const slug = `${base.slug.replace(/-\d+$/, "")}-${number}`;
		// As 6 primeiras variantes ficam em digital-art (total: 9 itens ou mais).
		const collection = i < 6 ? "digital-art" : COLLECTIONS[(i + 1) % COLLECTIONS.length];
		nfts.push(toNft(slug, `${name} #${number}`, collection, NETWORKS[i % NETWORKS.length], base.cents + (i % 5) * 10 + 5, null, 1 + (i % 6), base.slug));
	}
	return nfts;
}

// SHA-256 em hex, calculado uma vez e colado aqui. Nunca a senha em texto.
// Credenciais de demo: test@kurio.test / kurio.teste
// SHA-256 em hex, calculado uma vez e colado aqui. Nunca a senha em texto.
const MARINA_PASSWORD_HASH = "56469c8cf5318bc0c0f5fd037d61f055f5071e1c5f676af9c229b22bf55387d2";
const RAFAEL_PASSWORD_HASH = "60d9cad40db849fa00aab20f87ba8e0b9cff64fe5cf38a9e28d87f7a8f734a6d";

export const MARINA_ID = "user-marina";
export const RAFAEL_ID = "user-rafael";

export function createSeed(): Database {
	const nfts = createNfts();
	const editionStock: Record<string, EditionStockRecord> = {};
	// Import lazy via função local para evitar ciclo seed↔inventory na tipagem do seed.
	for (const nft of nfts) {
		const half = Math.floor(nft.available / 2);
		const rows: EditionStockRecord[] = [
			{ slug: nft.slug, editionId: "ed-1-1", remaining: 0, version: 1 },
			{ slug: nft.slug, editionId: "ed-1-10", remaining: half, version: 1 },
			{ slug: nft.slug, editionId: "ed-1-50", remaining: nft.available, version: 1 },
			{ slug: nft.slug, editionId: "ed-open", remaining: nft.available, version: 1 },
		];
		for (const row of rows) {
			editionStock[`${row.slug}::${row.editionId}`] = row;
		}
	}
	return {
		nfts,
		users: [
			{ id: MARINA_ID, name: "Marina Alves", email: "marina@kurio.test", passwordHash: MARINA_PASSWORD_HASH },
			{ id: RAFAEL_ID, name: "Rafael Costa", email: "rafael@kurio.test", passwordHash: RAFAEL_PASSWORD_HASH },
		],
		carts: {
			[MARINA_ID]: { items: [], couponCode: null },
			[RAFAEL_ID]: { items: [], couponCode: null },
		},
		orders: [],
		favorites: {
			[MARINA_ID]: ["emerald-ape-042"],
			[RAFAEL_ID]: [],
		},
		wallets: {
			[MARINA_ID]: [
				{ id: "wallet-marina-1", label: "Carteira principal", address: "0x4a1c9be2d03f7a85c6e1b2f09d34a7c85e61f0b3", network: "ethereum", primary: true },
				{ id: "wallet-marina-2", label: "Carteira Polygon", address: "0x91be07c3a5d2e48f60b19c7d3a82e54f1c06ad27", network: "polygon" },
			],
			[RAFAEL_ID]: [],
		},
		sessions: {},
		editionStock,
		reservations: {},
		cartMerges: {},
	};
}
