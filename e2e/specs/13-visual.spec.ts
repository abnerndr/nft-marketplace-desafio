import { expect, SEED, test } from "../fixtures";

/**
 * Regressão visual com os dados do seed. As baselines (`13-visual.spec.ts-snapshots/`) saem de
 * `npx playwright test --update-snapshots` e ficam versionadas, uma por viewport.
 */
test.describe("regressão visual", () => {
  test("início", async ({ kurio, page }) => {
    await kurio.open("/");
    await expect(page.locator("#catalogo-grade article")).toHaveCount(SEED.pageSize);
    await expect(page.getByRole("heading", { name: "Diário da Cunhagem" })).toBeVisible();
    await kurio.settle();
    await expect(page).toHaveScreenshot("inicio.png", { fullPage: true });
  });

  test("detalhe do NFT", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${SEED.firstNft.slug}`);
    await kurio.expectDetailLoaded();
    await expect(page.getByRole("heading", { name: "Mais desta coleção" })).toBeVisible();
    await kurio.settle();
    await expect(page).toHaveScreenshot("detalhe.png", { fullPage: true });
  });

  test("carrinho", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart(SEED.second.slug);
    await kurio.addToCart(SEED.firstNft.slug, 2);
    await page.goto("/cart");
    await expect(page.getByRole("list", { name: "Itens do carrinho" }).getByRole("listitem")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Colecionadores também viram" })).toBeVisible();
    await expect(page.locator("aside").filter({ hasText: "Taxa de rede" }).getByText("4.09 ETH", { exact: true })).toBeVisible();
    await kurio.settle();
    await expect(page).toHaveScreenshot("carrinho.png", { fullPage: true });
  });

  test("pagamento", async ({ kurio, page }) => {
    await kurio.checkoutReady("marina", SEED.second.slug);
    await expect(page.getByRole("complementary", { name: "Resumo do pedido" }).getByText("1.71 ETH", { exact: true })).toBeVisible();
    await kurio.settle();
    await expect(page).toHaveScreenshot("pagamento.png", { fullPage: true });
  });
});
