import { expect, test as base, type Locator, type Page } from "@playwright/test";
import type { ScenarioId } from "../src/mocks/scenarios";

export { expect };
export type { ScenarioId };

export const USERS = {
  marina: { name: "Marina Alves", email: "marina@kurio.test", password: "Marina#2026" },
  rafael: { name: "Rafael Costa", email: "rafael@kurio.test", password: "Rafael#2026" },
} as const;

export type UserKey = keyof typeof USERS;

/** Cupons do mock (`src/mocks/handlers/quote.ts`). */
export const COUPONS = { valid: "GENESIS10", other: "DROP5", expired: "VENCIDO" } as const;

/** Itens do seed usados pelos fluxos, com preço e estoque iniciais. */
export const SEED = {
  firstNft: { slug: "emerald-ape-042", title: "Emerald Ape #042", priceEth: "1.19", favorite: true },
  second: { slug: "sage-nomad-009", title: "Sage Nomad #009", priceEth: "1.69" },
  third: { slug: "neon-vessel-552", title: "Neon Vessel #552", priceEth: "1.99" },
  cheapest: { slug: "golden-signal-160", title: "Golden Signal #160", priceEth: "0.39" },
  pageSize: 9,
  total: 36,
  networkFee: "0.02",
} as const;

type StoredDb = {
  orders: { id: string; status: string; snapshot?: unknown }[];
  carts: Record<string, { items: { slug: string; quantity: number }[]; couponCode: string | null }>;
  favorites: Record<string, string[]>;
  idempotency?: Record<string, { orderId: string }>;
  sessions: Record<string, string>;
};

type Controls = {
  reset: () => void;
  setScenario: (id: string) => void;
  switchScenario: (id: string) => void;
  emit: (type: string, payload?: unknown) => void;
  disconnectSocket?: () => void;
  reconnectSocket?: () => void;
};

/** `window.__kurio` e `localStorage` existem na página; o teste só chama o que o app expõe. */
declare global {
  interface Window {
    __kurio?: Controls;
  }
}

export class Kurio {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Abre a rota com `?reset=1` (seed limpo) e, se pedido, `?scenario=`. Depois tira os dois
   * parâmetros da URL: sem isso, um `reload` voltaria ao seed e apagaria o que o teste fez.
   */
  async open(path = "/", options: { scenario?: ScenarioId } = {}): Promise<void> {
    const url = new URL(path, "http://kurio.local");
    url.searchParams.set("reset", "1");
    if (options.scenario) url.searchParams.set("scenario", options.scenario);
    await this.page.goto(`${url.pathname}${url.search}${url.hash}`);
    await this.page.waitForFunction(() => window.__kurio !== undefined);
    await this.page.evaluate(() => {
      const current = new URL(window.location.href);
      current.searchParams.delete("reset");
      current.searchParams.delete("scenario");
      window.history.replaceState(window.history.state, "", current);
    });
  }

  /** Entra pelo formulário de verdade e espera o redirecionamento. */
  async login(user: UserKey = "marina", redirect?: string): Promise<void> {
    const { email, password } = USERS[user];
    const target = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login";
    await this.page.goto(target);
    await this.page.getByRole("textbox", { name: "contato@email.com" }).fill(email);
    await this.page.getByLabel("Senha", { exact: true }).fill(password);
    await this.page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(this.page).not.toHaveURL(/\/login/);
  }

  /** Cenário pela API pública do mock: volta ao seed do cenário e apaga sessões. */
  async setScenario(id: ScenarioId): Promise<void> {
    await this.page.evaluate((scenario) => window.__kurio!.setScenario(scenario), id);
  }

  /**
   * Troca o cenário sem tocar no banco (sessão, carrinho e pedidos continuam).
   * Usa `window.__kurio.switchScenario` — sem importar `/src/...` (funciona no preview/build).
   */
  async switchScenario(id: ScenarioId): Promise<void> {
    await this.page.evaluate((scenario) => window.__kurio!.switchScenario(scenario), id);
  }

  /** Dispara um evento Socket.IO pelo transporte do mock. */
  async emit(type: string, payload?: unknown): Promise<void> {
    await this.page.evaluate(([name, data]) => window.__kurio!.emit(name as string, data), [type, payload] as const);
  }

  /** Estado do backend simulado, lido do `localStorage`. Só leitura: o teste não escreve no cache. */
  async db(): Promise<StoredDb> {
    return this.page.evaluate(() => {
      const raw = window.localStorage.getItem("kurio.mock");
      return (raw ? (JSON.parse(raw) as { db: StoredDb }).db : null) as StoredDb;
    });
  }

  /** Adiciona um NFT ao carrinho pela página de detalhe (edição e quantidade padrão). */
  async addToCart(slug: string, quantity = 1): Promise<void> {
    await this.page.goto(`/nfts/${slug}`);
    await this.expectDetailLoaded();
    if (quantity !== 1) await this.page.getByRole("spinbutton").fill(String(quantity));
    await this.buyButton().click();
    await expect(this.page.getByText("Adicionado ao carrinho.")).toBeVisible();
  }

  buyButton(): Locator {
    return this.page.getByRole("button", { name: /^(COMPRAR|Comprar NFT)$/ });
  }

  async expectDetailLoaded(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(this.page.getByRole("group", { name: "Edição" })).toBeVisible();
  }

  /** Carteira conectada para o pagamento: a primeira do seed da Marina. */
  async connectWallet(label = "Carteira principal"): Promise<void> {
    await this.page.getByRole("button", { name: `Conectar ${label}` }).click();
    await this.page.getByRole("button", { name: "Aprovar conexão" }).click();
    await expect(this.page.getByRole("button", { name: `Desconectar ${label}` })).toBeVisible();
  }

  /** Preenche o perfil do colecionador obrigatório no checkout. */
  async fillCollector(overrides: Partial<Record<string, string>> = {}): Promise<void> {
    const values = {
      displayName: "Marina Alves",
      username: "marina",
      profileName: "Marina",
      email: "marina@kurio.test",
      referralCode: "KURIO",
      ensName: "marina",
      ...overrides,
    };
    await this.page.locator("#collector-displayName").fill(values.displayName);
    await this.page.locator("#collector-username").fill(values.username);
    await this.page.locator("#collector-profileName").fill(values.profileName);
    await this.page.locator("#collector-email").fill(values.email);
    await this.page.locator("#collector-referral").fill(values.referralCode);
    await this.page.locator("#collector-ens").fill(values.ensName);
  }

  /**
   * Cliente logado, com `slug` no carrinho e a carteira principal conectada, na tela de pagamento
   * e com "Confirmar compra" liberado.
   */
  async checkoutReady(user: UserKey = "marina", slug: string = SEED.second.slug, scenario?: ScenarioId): Promise<void> {
    await this.open("/", scenario ? { scenario } : {});
    await this.login(user);
    await this.addToCart(slug);
    await this.page.goto("/checkout");
    await this.connectWallet("Carteira principal");
    await this.fillCollector();
    await expect(this.page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
  }

  /** Espera imagens, fontes e conteúdo preguiçoso antes de uma captura. */
  async settle(): Promise<void> {
    await this.page.evaluate(async () => {
      const step = Math.max(200, Math.floor(window.innerHeight / 2));
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      }
      window.scrollTo(0, 0);
    });
    await this.page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await this.page.evaluate(() => document.fonts.ready);
  }
}

export const test = base.extend<{ kurio: Kurio }>({
  kurio: async ({ page }, use) => {
    await use(new Kurio(page));
  },
});
