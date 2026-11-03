import type { Locator, Page } from "@playwright/test";
import { COUPONS, expect, SEED, test, USERS } from "../fixtures";

const summary = (page: Page) => page.locator("aside").filter({ hasText: "Taxa de rede" });
const rows = (page: Page) => page.getByRole("list", { name: "Itens do carrinho" }).getByRole("listitem");
const row = (page: Page, title: string) => rows(page).filter({ hasText: title });

/** Valor da linha do resumo (Subtotal, Taxa de rede, Total...). */
function value(page: Page, label: string): Locator {
  return summary(page).getByText(label, { exact: true }).locator("xpath=following-sibling::span");
}

const SAGE = SEED.second;
const EMERALD = SEED.firstNft;

test.describe("carrinho: quantidades, remoção, cupom e persistência", () => {
  test("mostra o carrinho vazio e leva de volta ao catálogo", async ({ kurio, page }) => {
    await kurio.open("/cart");
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
    await page.getByRole("link", { name: "Continuar explorando" }).first().click();
    await expect(page).toHaveURL(/#catalogo/);
  });

  test("soma o subtotal, a taxa e o total do que está no carrinho", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.addToCart(SAGE.slug);
    await kurio.addToCart(EMERALD.slug, 2);
    await page.goto("/cart");

    await expect(rows(page)).toHaveCount(2);
    await expect(value(page, "Subtotal")).toHaveText("4.07 ETH");
    await expect(value(page, "Desconto do lançamento")).toHaveText("(-) 0 ETH");
    await expect(value(page, "Taxa de rede")).toHaveText("0.02 ETH");
    await expect(value(page, "Total")).toHaveText("4.09 ETH");
  });

  test("altera a quantidade, respeita o estoque e atualiza o total", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart("violet-nomad-314");
    await page.goto("/cart");
    const violet = row(page, "Violet Nomad #314");
    await expect(value(page, "Subtotal")).toHaveText("1.39 ETH");

    await violet.getByRole("button", { name: "Aumentar quantidade de Violet Nomad #314" }).click();
    await expect(value(page, "Subtotal")).toHaveText("2.78 ETH");
    await expect(value(page, "Total")).toHaveText("2.8 ETH");
    // O estoque da edição é 2: o botão de aumentar trava.
    await expect(violet.getByRole("button", { name: "Aumentar quantidade de Violet Nomad #314" })).toBeDisabled();

    await violet.getByRole("button", { name: "Diminuir quantidade de Violet Nomad #314" }).click();
    await expect(value(page, "Subtotal")).toHaveText("1.39 ETH");
    await expect(violet.getByRole("button", { name: "Diminuir quantidade de Violet Nomad #314" })).toBeDisabled();
    expect((await kurio.db()).carts["user-marina"].items[0].quantity).toBe(1);
  });

  test("remove itens até esvaziar o carrinho", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.addToCart(SAGE.slug);
    await kurio.addToCart(EMERALD.slug);
    await page.goto("/cart");
    await expect(rows(page)).toHaveCount(2);

    await row(page, SAGE.title).getByRole("button", { name: `Remover ${SAGE.title} do carrinho` }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(value(page, "Subtotal")).toHaveText("1.19 ETH");
    await expect(page.getByRole("link", { name: "Carrinho", exact: true })).toContainText("1");

    await row(page, EMERALD.title).getByRole("button", { name: `Remover ${EMERALD.title} do carrinho` }).click();
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
  });

  test("aplica cupom válido, recusa inválido e vencido e remove o cupom", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.addToCart(SAGE.slug);
    await kurio.addToCart(EMERALD.slug, 2);
    await page.goto("/cart");
    const input = page.getByRole("textbox", { name: "Código promocional" });
    const apply = page.getByRole("button", { name: "Aplicar" });

    await input.fill("NAOEXISTE");
    await apply.click();
    await expect(page.getByRole("alert")).toHaveText("Cupom inválido.");
    await expect(page.getByText(/Cupom .* aplicado\./)).toHaveCount(0);

    await input.fill(COUPONS.expired);
    await apply.click();
    await expect(page.getByRole("alert")).toHaveText("Este cupom expirou.");
    await expect(value(page, "Desconto do lançamento")).toHaveText("(-) 0 ETH");

    await input.fill(COUPONS.valid.toLowerCase());
    await apply.click();
    await expect(page.getByText(`Cupom ${COUPONS.valid} aplicado.`)).toBeVisible();
    await expect(value(page, "Desconto do lançamento")).toHaveText("(-) 0.41 ETH");
    await expect(value(page, "Total")).toHaveText("3.68 ETH");

    await input.fill(COUPONS.other);
    await apply.click();
    await expect(page.getByText(`Cupom ${COUPONS.other} aplicado.`)).toBeVisible();
    await expect(value(page, "Desconto do lançamento")).toHaveText("(-) 0.2 ETH");

    await page.getByRole("button", { name: "Remover cupom" }).click();
    await expect(page.getByText(/Cupom .* aplicado\./)).toHaveCount(0);
    await expect(value(page, "Total")).toHaveText("4.09 ETH");
  });

  test("o carrinho de visitante sobrevive ao refresh, com cupom", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.addToCart(SAGE.slug, 2);
    await page.goto("/cart");
    await page.getByRole("textbox", { name: "Código promocional" }).fill(COUPONS.other);
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText(`Cupom ${COUPONS.other} aplicado.`)).toBeVisible();

    await page.reload();
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, SAGE.title)).toContainText("2");
    await expect(page.getByText(`Cupom ${COUPONS.other} aplicado.`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Carrinho", exact: true })).toContainText("2");
  });

  test("o carrinho de visitante vai para a conta no login e sobrevive ao refresh", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.addToCart(SAGE.slug);
    await page.goto("/cart");
    await page.getByRole("textbox", { name: "Código promocional" }).fill(COUPONS.valid);
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText(`Cupom ${COUPONS.valid} aplicado.`)).toBeVisible();

    await page.getByRole("link", { name: "Conectar e finalizar" }).click();
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcart/);
    await page.getByRole("textbox", { name: "contato@email.com" }).fill(USERS.marina.email);
    await page.getByLabel("Senha", { exact: true }).fill(USERS.marina.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(row(page, SAGE.title)).toBeVisible();
    await expect(page.getByText(`Cupom ${COUPONS.valid} aplicado.`)).toBeVisible();
    const cart = (await kurio.db()).carts["user-marina"];
    expect(cart.items).toEqual([expect.objectContaining({ slug: SAGE.slug, quantity: 1 })]);
    expect(cart.couponCode).toBe(COUPONS.valid);
    expect(await page.evaluate(() => window.localStorage.getItem("kurio.guest-cart"))).toBeNull();

    await page.reload();
    await expect(row(page, SAGE.title)).toBeVisible();
    await expect(page.getByText(`Cupom ${COUPONS.valid} aplicado.`)).toBeVisible();
  });

  test("quem já tem itens na conta junta o carrinho de visitante sem duplicar", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart(SAGE.slug);
    await page.getByRole("link", { name: "Carrinho", exact: true }).waitFor();
    await page.goto("/account/profile");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);

    await kurio.addToCart(SAGE.slug);
    await kurio.addToCart(EMERALD.slug);
    await kurio.login("marina");
    await page.goto("/cart");
    await expect(rows(page)).toHaveCount(2);
    await expect(row(page, SAGE.title)).toContainText("2");
    await expect(row(page, EMERALD.title)).toContainText("1");
  });
});
