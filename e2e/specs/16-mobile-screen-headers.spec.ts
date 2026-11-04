import { expect, SEED, test } from "../fixtures";

test.describe("mobile screen headers (390)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("carrinho: voltar + título centralizado, sem SiteHeader desktop", async ({ kurio, page }) => {
    await kurio.open("/cart");
    const header = page.locator("header").filter({ hasText: "Carrinho de NFTs" });
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: /voltar/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "KURIO" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
  });

  test("pagamento: voltar + título Pagamento com carteira", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart(SEED.firstNft.slug);
    await page.goto("/checkout");
    const header = page.locator("header").filter({ hasText: "Pagamento com carteira" });
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: /voltar/i })).toBeVisible();
  });

  test("detalhe: voltar + favoritar no topo, sem título de página no header", async ({ kurio, page }) => {
    await page.goto(`/nfts/${SEED.firstNft.slug}`);
    await kurio.expectDetailLoaded();
    await expect(page.getByRole("link", { name: /voltar/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /favoritar|favoritos/i }).first()).toBeVisible();
    // Não deve haver barra “Início” / KURIO acima do hero mobile
    await expect(page.getByRole("link", { name: "KURIO" })).toHaveCount(0);
  });

  test("início mobile: busca Explorar coleções sem título Início com voltar", async ({ kurio, page }) => {
    await kurio.open("/");
    await expect(page.getByRole("searchbox", { name: /explorar coleções/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Voltar" })).toHaveCount(0);
    await expect(page.locator("header").filter({ hasText: /^Início$/ })).toHaveCount(0);
  });
});

test.describe("desktop unchanged at 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("detalhe e carrinho mantêm breadcrumb e header KURIO", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${SEED.firstNft.slug}`);
    await expect(page.getByRole("link", { name: "KURIO" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegação estrutural" })).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByRole("navigation", { name: "Navegação estrutural" })).toContainText("Carrinho");
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
  });
});
