import type { Page } from "@playwright/test";
import { expect, SEED, test } from "../fixtures";

const grid = (page: Page) => page.locator("#catalogo-grade");
const heart = (page: Page, title: string) =>
  grid(page).locator("article", { hasText: title }).getByRole("button", { name: new RegExp(`^(Favoritar|Remover) ${title}`) });

async function ready(page: Page): Promise<void> {
  await expect(grid(page).locator("article")).toHaveCount(SEED.pageSize);
}

/** Logado: espera também a lista de favoritos do servidor (o favorito do seed aparece marcado). */
async function readyLoggedIn(page: Page): Promise<void> {
  await ready(page);
  await expect(heart(page, SEED.firstNft.title)).toHaveAttribute("aria-pressed", "true");
}

test.describe("favoritos: marcar, desmarcar, falha de mutation e recuperação", () => {
  test("visitante é levado ao login e volta ao catálogo", async ({ kurio, page }) => {
    await kurio.open("/");
    await ready(page);
    await heart(page, SEED.second.title).click();
    await expect(page).toHaveURL(/\/login\?redirect=/);

    await page.getByRole("textbox", { name: "contato@email.com" }).fill("marina@kurio.test");
    await page.getByLabel("Senha", { exact: true }).fill("Marina#2026");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await ready(page);
  });

  test("mostra o favorito do seed e marca e desmarca outro NFT com persistência", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/");
    await readyLoggedIn(page);

    await expect(heart(page, SEED.firstNft.title)).toHaveAttribute("aria-pressed", "true");
    await expect(heart(page, SEED.second.title)).toHaveAttribute("aria-pressed", "false");

    await heart(page, SEED.second.title).click();
    await expect(heart(page, SEED.second.title)).toHaveAttribute("aria-pressed", "true");
    await expect(heart(page, SEED.second.title)).toBeEnabled();
    expect((await kurio.db()).favorites["user-marina"]).toEqual([SEED.firstNft.slug, SEED.second.slug]);

    await page.reload();
    await readyLoggedIn(page);
    await expect(heart(page, SEED.second.title)).toHaveAttribute("aria-pressed", "true");

    await heart(page, SEED.firstNft.title).click();
    await expect(heart(page, SEED.firstNft.title)).toHaveAttribute("aria-pressed", "false");
    await expect(heart(page, SEED.firstNft.title)).toBeEnabled();
    expect((await kurio.db()).favorites["user-marina"]).toEqual([SEED.second.slug]);
  });

  test("o detalhe e a lista concordam sobre o favorito", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto(`/nfts/${SEED.second.slug}`);
    await kurio.expectDetailLoaded();
    const detailHeart = page.getByRole("button", { name: /^(Favoritar|Favoritado|Remover dos favoritos)$/ });
    await expect(detailHeart).toHaveAttribute("aria-pressed", "false");

    await detailHeart.click();
    await expect(detailHeart).toHaveAttribute("aria-pressed", "true");
    await expect(detailHeart).toBeEnabled();

    await page.goto("/");
    await readyLoggedIn(page);
    await expect(heart(page, SEED.second.title)).toHaveAttribute("aria-pressed", "true");

    await heart(page, SEED.second.title).click();
    await expect(heart(page, SEED.second.title)).toHaveAttribute("aria-pressed", "false");
    await expect(heart(page, SEED.second.title)).toBeEnabled();
    await page.goto(`/nfts/${SEED.second.slug}`);
    await kurio.expectDetailLoaded();
    await expect(detailHeart).toHaveAttribute("aria-pressed", "false");
  });

  test("atualização otimista aparece na hora com a rede lenta", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/");
    await readyLoggedIn(page);

    await kurio.switchScenario("slow-network");
    const button = heart(page, SEED.second.title);
    await button.click();
    // Os 1,2 s da rede ainda não passaram: o estado já mudou e o botão espera a resposta.
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toBeDisabled();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  });

  test("falha na mutation desfaz o estado otimista e uma nova tentativa recupera", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/");
    await readyLoggedIn(page);

    await kurio.switchScenario("offline");
    await heart(page, SEED.second.title).click();
    await expect(heart(page, SEED.second.title)).toHaveAttribute("aria-pressed", "false");
    await expect(heart(page, SEED.second.title)).toBeEnabled();
    // Desmarcar o favorito do seed também volta atrás.
    await heart(page, SEED.firstNft.title).click();
    await expect(heart(page, SEED.firstNft.title)).toHaveAttribute("aria-pressed", "true");
    await expect(heart(page, SEED.firstNft.title)).toBeEnabled();
    expect((await kurio.db()).favorites["user-marina"]).toEqual([SEED.firstNft.slug]);

    await kurio.switchScenario("default");
    await heart(page, SEED.second.title).click();
    await expect(heart(page, SEED.second.title)).toHaveAttribute("aria-pressed", "true");
    await expect(heart(page, SEED.second.title)).toBeEnabled();
    expect((await kurio.db()).favorites["user-marina"]).toEqual([SEED.firstNft.slug, SEED.second.slug]);

    await page.reload();
    await readyLoggedIn(page);
    await expect(heart(page, SEED.second.title)).toHaveAttribute("aria-pressed", "true");
    await expect(heart(page, SEED.firstNft.title)).toHaveAttribute("aria-pressed", "true");
  });

  test("favoritar com a sessão expirada manda para o login sem gravar nada", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/");
    await readyLoggedIn(page);

    await kurio.switchScenario("session-expired");
    await heart(page, SEED.second.title).click();
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await kurio.switchScenario("default");
    expect((await kurio.db()).favorites["user-marina"]).toEqual([SEED.firstNft.slug]);
  });
});
