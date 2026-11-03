import type { Page } from "@playwright/test";
import { expect, SEED, test } from "../fixtures";

const SAGE = SEED.second;
const notice = (page: Page) => page.getByTestId("price-notice");
const summary = (page: Page) => page.getByRole("complementary", { name: "Resumo do pedido" });

test.describe("alteração de preço pelo Socket.IO durante o checkout", () => {
  test("nft.updated no pagamento avisa, recalcula o resumo e a compra fecha no preço novo", async ({ kurio, page }) => {
    await kurio.checkoutReady("marina", SAGE.slug);
    await expect(summary(page).getByText("1.71 ETH", { exact: true })).toBeVisible();

    // +10% no primeiro item do carrinho: 1.69 -> 1.86, pelo transporte Socket.IO do mock.
    await kurio.emit("nft.updated");

    await expect(notice(page)).toHaveCount(1);
    await expect(notice(page)).toContainText(SAGE.title);
    await expect(notice(page)).toContainText("1.69 ETH");
    await expect(notice(page)).toContainText("1.86 ETH");
    await expect(summary(page).getByText("1.88 ETH", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    await expect(page.getByRole("article").getByText("1.88 ETH").first()).toBeVisible();
    const db = await kurio.db();
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].status).toBe("confirmed");
  });

  test("o aviso pode ser dispensado e o carrinho mostra o preço novo", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart(SAGE.slug);
    await page.goto("/cart");
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText("1.69 ETH");

    await kurio.emit("nft.updated");
    await expect(notice(page)).toContainText("1.86 ETH");
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText("1.86 ETH");
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).not.toContainText("1.69 ETH");

    await notice(page).getByRole("button", { name: "Entendi" }).click();
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText("1.86 ETH");
  });

  test("mudança entre a revisão e a confirmação pede nova confirmação e não cria pedido velho", async ({ kurio, page }) => {
    await kurio.checkoutReady("marina", SAGE.slug);
    const confirm = page.getByRole("button", { name: "Confirmar compra" });
    await expect(summary(page).getByText("1.71 ETH", { exact: true })).toBeVisible();

    // Com a rede lenta, o clique chega antes de a tela receber a cotação nova: o servidor já está na versão 2.
    await kurio.switchScenario("slow-network");
    await kurio.emit("nft.updated");
    await confirm.click();

    const changed = page.getByRole("alert").filter({ hasText: "Os valores mudaram desde a sua revisão." });
    await expect(changed).toBeVisible();
    await expect(changed).toContainText("1.88 ETH");
    await expect(confirm).toBeDisabled();
    expect((await kurio.db()).orders).toHaveLength(0);

    await kurio.switchScenario("default");
    await changed.getByRole("button", { name: "Confirmar novos valores" }).click();
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    await expect(page.getByRole("article").getByText("1.88 ETH").first()).toBeVisible();
    expect((await kurio.db()).orders).toHaveLength(1);
  });

  test("cenário price-changed empurra a mudança sozinho com o item no carrinho", async ({ kurio, page }) => {
    await kurio.open("/", { scenario: "price-changed" });
    await kurio.login("marina");
    await kurio.addToCart(SAGE.slug);
    await page.goto("/cart");

    // O mock espera 1,5 s com o socket aberto e então muda o primeiro item (+10%).
    await expect(notice(page)).toContainText(SAGE.title, { timeout: 15_000 });
    await expect(notice(page)).toContainText("1.86 ETH");
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText("1.86 ETH");
  });

  test("visitante não abre socket e não recebe aviso", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.addToCart(SAGE.slug);
    await page.goto("/cart");
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText("1.69 ETH");

    await kurio.emit("nft.updated");
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText("1.69 ETH");
  });
});
