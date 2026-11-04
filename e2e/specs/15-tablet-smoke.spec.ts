import { expect, SEED, test, USERS } from "../fixtures";

/**
 * Smoke em 768: todas as rotas principais carregam sem overflow horizontal
 * e sem erro óbvio de tela.
 */
test.describe("smoke tablet 768", () => {
  test.use({ viewport: { width: 768, height: 1080 } });

  test("rotas públicas e autenticadas em 768", async ({ kurio, page }) => {
    await kurio.open("/");
    await expect(page.locator("#catalogo-grade article")).toHaveCount(SEED.pageSize);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    await page.goto(`/nfts/${SEED.firstNft.slug}`);
    await kurio.expectDetailLoaded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();

    await page.goto("/register");
    await expect(page.getByRole("button", { name: "Criar conta", exact: true })).toBeVisible();

    await kurio.login("marina");
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Carrinho de NFTs" })).toBeVisible();

    await kurio.addToCart(SEED.second.slug);
    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    await page.goto("/account/profile");
    await expect(page.getByRole("textbox", { name: "Nome de exibição" })).toHaveValue(USERS.marina.name);
    await expect(page.getByRole("button", { name: "Remover", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    await page.goto("/account/wallets");
    await expect(page.getByRole("heading", { name: /carteira/i }).first()).toBeVisible();
  });
});
