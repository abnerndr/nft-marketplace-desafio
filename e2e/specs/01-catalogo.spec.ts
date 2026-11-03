import type { Page } from "@playwright/test";
import { expect, SEED, test } from "../fixtures";

const cards = (page: Page) => page.locator("#catalogo-grade article");
const total = (page: Page) => page.getByRole("status").filter({ hasText: /NFTs encontrados/ });

async function titles(page: Page): Promise<string[]> {
  return cards(page).getByRole("heading", { level: 3 }).allTextContents();
}

async function prices(page: Page): Promise<number[]> {
  const texts = await cards(page).locator("p > span:first-child").allTextContents();
  return texts.map((text) => Number(text.replace(" ETH", "")));
}

/** No mobile os filtros ficam atrás do botão "Filtros". */
async function openFilters(page: Page): Promise<void> {
  const toggle = page.getByRole("button", { name: "Filtros", exact: true });
  if (await toggle.isVisible()) {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }
  await expect(page.getByRole("form", { name: "Filtros do catálogo" })).toBeVisible();
}

async function search(page: Page, text: string): Promise<void> {
  const box = page.getByRole("searchbox", { name: "Buscar NFTs" });
  if (!(await box.isVisible())) await page.getByRole("button", { name: "Abrir busca" }).click();
  await box.fill(text);
  await box.press("Enter");
}

test.describe("catálogo: busca, filtros, ordenação e paginação", () => {
  test("lista a primeira página do seed e mostra o total", async ({ kurio, page }) => {
    await kurio.open("/");
    await expect(cards(page)).toHaveCount(SEED.pageSize);
    await expect(total(page)).toHaveText(`${SEED.total} NFTs encontrados`);
    await expect(cards(page).first()).toHaveAccessibleName(SEED.firstNft.title);
  });

  test("busca por título sem acento nem caixa e limpa a página", async ({ kurio, page }) => {
    await kurio.open("/");
    await search(page, "nomad");
    await expect(page).toHaveURL(/[?&]q=nomad/);
    await expect(total(page)).toHaveText(/^\d+ NFTs encontrados$/);
    const found = await titles(page);
    expect(found.length).toBeGreaterThan(1);
    for (const title of found) expect(title).toMatch(/Nomad/i);

    await search(page, "zzz inexistente");
    await expect(page.getByText("Nenhum NFT encontrado para esta busca.")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(cards(page)).toHaveCount(SEED.pageSize);
    await expect(page).not.toHaveURL(/q=/);
  });

  test("combina coleção, rede e faixa de preço e ordena por preço", async ({ kurio, page }) => {
    await kurio.open("/");
    await openFilters(page);

    await page.getByRole("checkbox", { name: /^Arte digital/ }).check();
    await expect(page).toHaveURL(/collection=digital-art/);
    const afterCollection = Number((await total(page).textContent())?.match(/^(\d+)/)?.[1]);
    expect(afterCollection).toBeGreaterThan(0);
    expect(afterCollection).toBeLessThan(SEED.total);

    await page.getByRole("checkbox", { name: /^Ethereum/ }).check();
    await expect(page).toHaveURL(/network=ethereum/);
    const afterNetwork = Number((await total(page).textContent())?.match(/^(\d+)/)?.[1]);
    expect(afterNetwork).toBeLessThanOrEqual(afterCollection);
    expect(afterNetwork).toBeGreaterThan(0);

    await page.getByRole("slider", { name: "Preço máximo em ETH" }).fill("1.5");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/maxPrice=1\.50/);
    await expect.poll(async () => (await prices(page)).length).toBeGreaterThan(0);
    for (const price of await prices(page)) expect(price).toBeLessThanOrEqual(1.5);

    await page.getByLabel("Ordenar por:").selectOption("price_desc");
    await expect(page).toHaveURL(/sort=price_desc/);
    await expect(async () => {
      const list = await prices(page);
      expect(list).toEqual([...list].sort((a, b) => b - a));
    }).toPass();

    await page.getByLabel("Ordenar por:").selectOption("price_asc");
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(async () => {
      const list = await prices(page);
      expect(list).toEqual([...list].sort((a, b) => a - b));
    }).toPass();
  });

  test("abas filtram o catálogo", async ({ kurio, page }) => {
    await kurio.open("/");
    await page.getByRole("tab", { name: "Novos lançamentos" }).click();
    await expect(page).toHaveURL(/tab=new/);
    await expect(page.getByRole("tab", { name: "Novos lançamentos" })).toHaveAttribute("aria-selected", "true");
    await expect(total(page)).toHaveText("12 NFTs encontrados");
  });

  test("pagina em 4 páginas e mantém filtro e ordenação", async ({ kurio, page }) => {
    await kurio.open("/?sort=name");
    const nav = page.getByRole("navigation", { name: "Paginação" });
    await expect(nav.getByRole("button", { name: "Página 1" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("button", { name: "Página anterior" })).toHaveCount(0);
    const first = await titles(page);

    await nav.getByRole("button", { name: "Página 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/sort=name/);
    await expect(nav.getByRole("button", { name: "Página 2" })).toHaveAttribute("aria-current", "page");
    await expect.poll(() => titles(page)).not.toEqual(first);

    await nav.getByRole("button", { name: "Próxima página" }).click();
    await expect(page).toHaveURL(/page=3/);
    await nav.getByRole("button", { name: "Página 4" }).click();
    await expect(page).toHaveURL(/page=4/);
    await expect(nav.getByRole("button", { name: "Próxima página" })).toHaveCount(0);
    await expect(cards(page)).toHaveCount(SEED.total - SEED.pageSize * 3);

    await nav.getByRole("button", { name: "Página anterior" }).click();
    await expect(page).toHaveURL(/page=3/);
  });

  test("volta e avança pelo histórico e restaura busca e página pela URL", async ({ kurio, page }) => {
    await kurio.open("/");
    await expect(cards(page)).toHaveCount(SEED.pageSize);
    const initial = await titles(page);

    await search(page, "a");
    await expect(page).toHaveURL(/[?&]q=a(&|#|$)/);
    await expect(total(page)).not.toHaveText(`${SEED.total} NFTs encontrados`);
    await expect(cards(page).first()).toBeVisible();
    const searched = await titles(page);

    await page.getByRole("navigation", { name: "Paginação" }).getByRole("button", { name: "Página 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect.poll(() => titles(page)).not.toEqual(searched);
    const secondPage = await titles(page);

    await page.goBack();
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page).toHaveURL(/q=a/);
    await expect.poll(() => titles(page)).toEqual(searched);

    await page.goBack();
    await expect(page).not.toHaveURL(/q=/);
    await expect.poll(() => titles(page)).toEqual(initial);

    await page.goForward();
    await page.goForward();
    await expect(page).toHaveURL(/page=2/);
    await expect.poll(() => titles(page)).toEqual(secondPage);

    // Recarregar com a URL atual traz o mesmo estado.
    await page.reload();
    await expect(page).toHaveURL(/q=a/);
    await expect(page.getByRole("navigation", { name: "Paginação" }).getByRole("button", { name: "Página 2" })).toHaveAttribute("aria-current", "page");
    await expect.poll(() => titles(page)).toEqual(secondPage);
  });

  test("abre a URL com filtros e mostra os controles já marcados", async ({ kurio, page }) => {
    await kurio.open("/?collection=music&collection=3d&sort=price_desc&tab=all");
    await openFilters(page);
    await expect(page.getByRole("checkbox", { name: /^Música/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Arte 3D/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Fotografia/ })).not.toBeChecked();
    await expect(page.getByLabel("Ordenar por:")).toHaveValue("price_desc");
    await expect(page.getByRole("tab", { name: "Todos os NFTs" })).toHaveAttribute("aria-selected", "true");
  });

  test("cenário empty mostra o estado vazio", async ({ kurio, page }) => {
    await kurio.open("/", { scenario: "empty" });
    await expect(page.getByText("Nenhum NFT encontrado para esta busca.")).toBeVisible();
    await expect(total(page)).toHaveText("0 NFTs encontrados");
    await expect(cards(page)).toHaveCount(0);
  });

  test("cenário out-of-order: resposta antiga não troca a lista mais nova", async ({ kurio, page }) => {
    const requested: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/nfts?")) requested.push(new URL(request.url()).searchParams.get("sort") ?? "");
    });
    await kurio.open("/", { scenario: "out-of-order" });
    // A primeira busca (recent) espera 900 ms e a segunda (name) 400 ms: a nova chegaria antes da antiga.
    await page.getByLabel("Ordenar por:").selectOption("name");
    await expect(page).toHaveURL(/sort=name/);
    await expect(cards(page).first()).toBeVisible();
    expect(requested).toEqual(["recent", "name"]);
    const list = await titles(page);
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b, "pt-BR")));
    await expect(page.getByLabel("Ordenar por:")).toHaveValue("name");
  });
});
