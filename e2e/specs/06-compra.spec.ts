import type { Page } from "@playwright/test";
import { expect, SEED, test } from "../fixtures";

const SAGE = SEED.second;

const summary = (page: Page) => page.getByRole("complementary", { name: "Resumo do pedido" });

test.describe("compra completa: do catálogo ao recibo confirmado", () => {
  test("escolhe um NFT, paga com a carteira conectada e vê o recibo", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/");

    // Catálogo -> detalhe.
    const card = page.locator("#catalogo-grade article", { hasText: SAGE.title });
    await card.getByRole("link", { name: SAGE.title }).click();
    await kurio.expectDetailLoaded();
    await expect(page.getByRole("heading", { level: 1, name: SAGE.title })).toBeVisible();

    // Detalhe -> carrinho.
    await kurio.buyButton().click();
    await expect(page.getByText("Adicionado ao carrinho.")).toBeVisible();
    await page.getByRole("status").getByRole("link", { name: "Ver carrinho" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText(SAGE.title);

    // Carrinho -> pagamento.
    await page.getByRole("link", { name: "Conectar e finalizar" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pagamento com carteira" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();
    await expect(page.getByText("Conecte uma carteira para confirmar a compra.")).toBeVisible();

    await kurio.connectWallet("Carteira principal");
    await expect(summary(page).getByText("1.71 ETH")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();
    await kurio.fillCollector();
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
    await page.getByRole("button", { name: "Confirmar compra" }).click();

    // Recibo só com o servidor dizendo `confirmed`.
    await expect(page).toHaveURL(/\/orders\/order-/);
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    const receipt = page.getByRole("article");
    await expect(receipt.getByText("ID da transação")).toBeVisible();
    await expect(receipt.getByText("Carteira principal", { exact: true })).toBeVisible();
    await expect(receipt.getByRole("list", { name: "Itens do pedido" })).toContainText(SAGE.title);
    await expect(receipt.getByText("1.71 ETH").first()).toBeVisible();
    await expect(receipt.getByText("Transação confirmada na Ethereum.", { exact: false })).toBeVisible();
    await expect(receipt.getByRole("link", { name: "Ver no Etherscan" })).toHaveAttribute("href", /^https:\/\/etherscan\.io\/tx\/0x[0-9a-f]{64}$/);

    // O servidor gravou um pedido confirmado, tirou o item do carrinho e baixou o estoque.
    const db = await kurio.db();
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].status).toBe("confirmed");
    expect(db.carts["user-marina"].items).toEqual([]);

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
    await page.goto(`/nfts/${SAGE.slug}`);
    await kurio.expectDetailLoaded();
    await page.getByRole("group", { name: "Edição" }).getByRole("button", { name: "1/50" }).click();
    await expect(page.getByRole("spinbutton")).toHaveAttribute("max", "3");
  });

  test("o recibo continua depois de recarregar e é privado do dono", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart(SAGE.slug);
    await page.goto("/checkout");
    await kurio.connectWallet("Carteira principal");
    await kurio.fillCollector();
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    const receiptUrl = page.url();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();

    // Outro usuário não enxerga o pedido.
    await page.goto("/account/profile");
    await page.getByRole("button", { name: "Sair" }).click();
    await kurio.login("rafael");
    await page.goto(receiptUrl);
    await expect(page.getByRole("heading", { name: "Pedido não encontrado" })).toBeVisible();
  });

  test("compra com cupom mostra o desconto no pagamento e no recibo", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart(SEED.firstNft.slug, 2);
    await page.goto("/cart");
    await page.getByRole("textbox", { name: "Código promocional" }).fill("GENESIS10");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("Cupom GENESIS10 aplicado.")).toBeVisible();

    await page.getByRole("link", { name: "Conectar e finalizar" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await kurio.connectWallet("Carteira principal");
    await kurio.fillCollector();
    // 2 x 1.19 = 2.38; desconto 0.238; taxa 0.02; total 2.162.
    await expect(summary(page).getByText("2.162 ETH")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar compra" }).click();

    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    const receipt = page.getByRole("article");
    await expect(receipt.getByText("Desconto (GENESIS10)")).toBeVisible();
    await expect(receipt.getByText("(-) 0.238 ETH")).toBeVisible();
    await expect(receipt.getByText("2.162 ETH").first()).toBeVisible();
  });

  test("pagamento sem login cai na tela de entrada e volta ao pagamento", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.addToCart(SAGE.slug);
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/);

    await page.getByRole("textbox", { name: "contato@email.com" }).fill("marina@kurio.test");
    await page.getByLabel("Senha", { exact: true }).fill("Marina#2026");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pagamento com carteira" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Carteiras" })).toBeVisible();
  });

  test("carrinho vazio no pagamento oferece voltar ao catálogo", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("rafael");
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toHaveCount(0);
  });
});
