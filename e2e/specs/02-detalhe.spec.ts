import { expect, SEED, test } from "../fixtures";

const { firstNft } = SEED;

test.describe("detalhe do NFT: acesso direto e NFT inexistente", () => {
  test("abre o detalhe direto pela URL com os dados do seed", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${firstNft.slug}`);
    await kurio.expectDetailLoaded();

    await expect(page.getByRole("heading", { level: 1, name: firstNft.title })).toBeVisible();
    await expect(page.getByText("ID do token: #0042")).toBeVisible();
    await expect(page.getByText("Coleção: Kurio Apes")).toBeVisible();
    await expect(page.getByText("Atributos: Óculos, Esmeralda, Raro")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Detalhes do NFT" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mais desta coleção" })).toBeVisible();
    await expect(page.getByText(`${firstNft.priceEth} ETH`, { exact: true }).locator("visible=true").first()).toBeVisible();
  });

  test("recarregar o detalhe mantém o mesmo NFT", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${SEED.second.slug}`);
    await kurio.expectDetailLoaded();
    await page.reload();
    await kurio.expectDetailLoaded();
    await expect(page.getByRole("heading", { level: 1, name: SEED.second.title })).toBeVisible();
  });

  test("a edição 1/1 esgotada bloqueia a compra e as demais liberam", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${firstNft.slug}`);
    await kurio.expectDetailLoaded();
    const edition = page.getByRole("group", { name: "Edição" });

    await edition.getByRole("button", { name: "1/1, esgotada" }).click();
    await expect(page.getByText("Esta edição está esgotada.")).toBeVisible();
    await expect(kurio.buyButton()).toBeDisabled();

    await edition.getByRole("button", { name: "1/10" }).click();
    await expect(page.getByText("Esta edição está esgotada.")).toHaveCount(0);
    await expect(kurio.buyButton()).toBeEnabled();
  });

  test("valida a quantidade contra o estoque da edição", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${firstNft.slug}`);
    await kurio.expectDetailLoaded();
    const quantity = page.getByRole("spinbutton");

    await quantity.fill("0");
    await expect(page.getByRole("alert")).toHaveText("Informe uma quantidade inteira de 1 a 5.");
    await expect(kurio.buyButton()).toBeDisabled();

    await quantity.fill("6");
    await expect(page.getByRole("alert")).toHaveText("Informe uma quantidade inteira de 1 a 5.");

    await quantity.fill("5");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Aumentar quantidade" })).toBeDisabled();
    await page.getByRole("button", { name: "Diminuir quantidade" }).click();
    await expect(quantity).toHaveValue("4");
    await expect(kurio.buyButton()).toBeEnabled();
  });

  test("visitante compra para o carrinho local e o contador do cabeçalho sobe", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${firstNft.slug}`);
    await kurio.expectDetailLoaded();
    await page.getByRole("spinbutton").fill("2");
    await kurio.buyButton().click();

    await expect(page.getByText("Adicionado ao carrinho.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Carrinho", exact: true })).toContainText("2");
    await page.getByRole("status").getByRole("link", { name: "Ver carrinho" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText(firstNft.title);
  });

  test("NFT inexistente mostra o estado de não encontrado e volta ao catálogo", async ({ kurio, page }) => {
    await kurio.open("/nfts/nao-existe-999");
    await expect(page.getByRole("heading", { level: 1, name: "NFT não encontrado" })).toBeVisible();
    await expect(page.getByText("Não achamos nenhum NFT com este endereço.")).toBeVisible();
    // 404 não tem botão de nova tentativa.
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toHaveCount(0);

    await page.getByRole("link", { name: "Voltar ao catálogo" }).click();
    await expect(page).toHaveURL(/\/$|\/#catalogo$|\/\?/);
    await expect(page.locator("#catalogo-grade article")).toHaveCount(SEED.pageSize);
  });

  test("um card do catálogo leva ao detalhe e o voltar do navegador retorna à lista", async ({ kurio, page }) => {
    await kurio.open("/?sort=name");
    await expect(page.locator("#catalogo-grade article")).toHaveCount(SEED.pageSize);
    const first = page.locator("#catalogo-grade article").first();
    const title = (await first.getByRole("heading", { level: 3 }).textContent()) ?? "";
    await first.getByRole("link", { name: title }).click();
    await expect(page).toHaveURL(/\/nfts\//);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/sort=name/);
    await expect(page.locator("#catalogo-grade article")).toHaveCount(SEED.pageSize);
  });
});
