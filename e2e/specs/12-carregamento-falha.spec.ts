import type { Page } from "@playwright/test";
import { expect, SEED, test } from "../fixtures";

const cards = (page: Page) => page.locator("#catalogo-grade article");
const skeletons = (page: Page) => page.getByTestId("nft-card-skeleton");

test.describe("skeletons, feedback de falha e recuperação", () => {
  test("rede lenta mostra os skeletons do catálogo e depois os cards", async ({ kurio, page }) => {
    await kurio.open("/", { scenario: "slow-network" });

    await expect(skeletons(page)).toHaveCount(SEED.pageSize);
    await expect(page.locator("#catalogo-grade > div")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("status").filter({ hasText: "Carregando NFTs" })).toBeAttached();
    await expect(cards(page)).toHaveCount(0);

    await expect(cards(page)).toHaveCount(SEED.pageSize);
    await expect(skeletons(page)).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "NFTs encontrados" })).toHaveText(`${SEED.total} NFTs encontrados`);
  });

  test("rede lenta mostra o skeleton do detalhe", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${SEED.firstNft.slug}`, { scenario: "slow-network" });
    await expect(page.getByRole("status", { name: "Carregando NFT" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);

    await kurio.expectDetailLoaded();
    await expect(page.getByRole("status", { name: "Carregando NFT" })).toHaveCount(0);
  });

  test("rede lenta mostra o skeleton do carrinho antes dos itens", async ({ kurio, page }) => {
    await kurio.open("/", { scenario: "slow-network" });
    await kurio.addToCart(SEED.second.slug);
    await page.goto("/cart");

    await expect(page.getByRole("status", { name: "Carregando carrinho" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText(SEED.second.title);
    await expect(page.getByRole("status", { name: "Carregando carrinho" })).toHaveCount(0);
  });

  test("rede lenta mostra o skeleton do pagamento antes da tela", async ({ kurio, page }) => {
    test.setTimeout(60_000);
    await kurio.open("/", { scenario: "slow-network" });
    await kurio.login("marina");
    await page.goto("/checkout");

    await expect(page.getByRole("status", { name: "Carregando pagamento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Carregando pagamento" })).toHaveCount(0);
  });

  test("erro 503 no catálogo mostra o aviso e a nova tentativa recupera a lista", async ({ kurio, page }) => {
    await kurio.open("/", { scenario: "server-error" });

    const alert = page.getByRole("alert").filter({ hasText: "Não foi possível carregar os NFTs." });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Serviço indisponível. Tente novamente.");
    await expect(cards(page)).toHaveCount(0);

    await alert.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(cards(page)).toHaveCount(SEED.pageSize);
    await expect(alert).toHaveCount(0);
  });

  test("erro 503 no detalhe mostra o aviso e a nova tentativa abre o NFT", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${SEED.firstNft.slug}`, { scenario: "server-error" });

    await expect(page.getByRole("heading", { name: "Não foi possível carregar o NFT" })).toBeVisible();
    await expect(page.getByText("Serviço indisponível. Tente novamente.")).toBeVisible();

    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await kurio.expectDetailLoaded();
    await expect(page.getByRole("heading", { level: 1, name: SEED.firstNft.title })).toBeVisible();
  });

  test("sem rede o catálogo falha e volta quando a rede volta", async ({ kurio, page }) => {
    await kurio.open("/", { scenario: "offline" });
    const alert = page.getByRole("alert").filter({ hasText: "Não foi possível carregar os NFTs." });
    await expect(alert).toBeVisible();

    await kurio.switchScenario("default");
    await alert.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(cards(page)).toHaveCount(SEED.pageSize);
  });

  test("sem rede o carrinho mostra erro e a nova tentativa traz os itens", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart(SEED.second.slug);
    await page.goto("/");
    await expect(cards(page)).toHaveCount(SEED.pageSize);

    await kurio.switchScenario("offline");
    await page.getByRole("link", { name: "Carrinho", exact: true }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button", { name: "Tentar novamente" })).toBeVisible();

    await kurio.switchScenario("default");
    await alert.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText(SEED.second.title);
  });

  test("falha ao adicionar ao carrinho mostra o erro e a nova tentativa adiciona", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto(`/nfts/${SEED.second.slug}`);
    await kurio.expectDetailLoaded();

    await kurio.switchScenario("offline");
    await kurio.buyButton().click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("Adicionado ao carrinho.")).toHaveCount(0);
    expect((await kurio.db()).carts["user-marina"].items).toEqual([]);

    await kurio.switchScenario("default");
    await kurio.buyButton().click();
    await expect(page.getByText("Adicionado ao carrinho.")).toBeVisible();
    expect((await kurio.db()).carts["user-marina"].items).toHaveLength(1);
  });

  test("pedido inexistente mostra o erro com saída para o catálogo", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/orders/order-que-nao-existe");
    await expect(page.getByRole("alert")).toContainText("Pedido não encontrado");
    await expect(page.getByRole("alert")).toContainText("Pedido não encontrado.");
    await page.getByRole("link", { name: "Voltar ao catálogo" }).click();
    await expect(cards(page)).toHaveCount(SEED.pageSize);
  });

  test("perfil e carteiras sem sessão válida levam ao login em vez de ficar carregando", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/account/profile");
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toBeVisible();

    await kurio.setScenario("session-expired");
    await page.goto("/account/wallets");
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Fwallets/);
  });
});
