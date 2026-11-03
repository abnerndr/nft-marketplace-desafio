import type { Page } from "@playwright/test";
import { expect, SEED, test, USERS } from "../fixtures";

/** Nome de quem tem o foco: `aria-label` ou o texto visível. */
async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return "";
    return (element.getAttribute("aria-label") ?? element.textContent ?? element.tagName).trim();
  });
}

async function tabTo(page: Page, name: string, limit = 40): Promise<void> {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press("Tab");
    if ((await focused(page)) === name) return;
  }
  throw new Error(`O foco não chegou em "${name}" em ${limit} Tab.`);
}

test.describe("teclado, foco e validação de formulário", () => {
  test("o Tab percorre o cabeçalho na ordem do documento", async ({ kurio, page }) => {
    await kurio.open("/");
    await expect(page.locator("#catalogo-grade article")).toHaveCount(SEED.pageSize);

    const order: string[] = [];
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press("Tab");
      order.push(await focused(page));
    }
    expect(order).toEqual(["KURIO", "Início", "Mercado", "Criadores", "Aprenda", "Abrir busca", "Carrinho", "Entrar"]);
  });

  test("a busca abre pelo teclado, devolve o foco ao fechar e envia com Enter", async ({ kurio, page }) => {
    await kurio.open("/");
    const toggle = page.getByRole("button", { name: "Abrir busca" });

    await toggle.focus();
    await page.keyboard.press("Enter");
    const box = page.getByRole("searchbox", { name: "Buscar NFTs" });
    await expect(box).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(box).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("Enter");
    await expect(box).toBeFocused();
    await page.keyboard.type("golden");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/q=golden/);
    await expect(page.locator("#catalogo-grade article").first()).toContainText("Golden");
  });

  test("filtros, abas e paginação funcionam só com o teclado", async ({ kurio, page }) => {
    await kurio.open("/");
    await expect(page.locator("#catalogo-grade article")).toHaveCount(SEED.pageSize);

    const toggle = page.getByRole("button", { name: "Filtros", exact: true });
    if (await toggle.isVisible()) {
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    }
    const music = page.getByRole("checkbox", { name: /^Música/ });
    await music.focus();
    await page.keyboard.press("Space");
    await expect(music).toBeChecked();
    await expect(page).toHaveURL(/collection=music/);

    const tab = page.getByRole("tab", { name: "Em alta" });
    await tab.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/tab=trending/);
    await expect(tab).toHaveAttribute("aria-selected", "true");
  });

  test("um card do catálogo abre o detalhe com Enter no link do título", async ({ kurio, page }) => {
    await kurio.open("/");
    const first = page.locator("#catalogo-grade article").first();
    await expect(first).toBeVisible();
    await first.getByRole("link").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/nfts\/emerald-ape-042/);
    await kurio.expectDetailLoaded();
  });

  test("login mostra os erros ligados aos campos e Enter envia o formulário", async ({ kurio, page }) => {
    await kurio.open("/login");
    const email = page.getByRole("textbox", { name: "contato@email.com" });
    const secret = page.getByLabel("Senha", { exact: true });

    await email.focus();
    await page.keyboard.press("Enter");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Informe seu e-mail.");
    await expect(secret).toHaveAttribute("aria-invalid", "true");
    await expect(secret).toHaveAccessibleDescription("Informe sua senha.");

    await page.keyboard.type(USERS.marina.email);
    await page.keyboard.press("Tab");
    await expect(secret).toBeFocused();
    await page.keyboard.type("errada#123");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
    await expect(email).toHaveAccessibleDescription("E-mail ou senha incorretos.");

    await secret.fill(USERS.marina.password);
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("o botão de mostrar senha é alcançável e informa o estado", async ({ kurio, page }) => {
    await kurio.open("/login");
    const secret = page.getByLabel("Senha", { exact: true });
    await secret.focus();
    await page.keyboard.press("Tab");
    const toggle = page.getByRole("button", { name: "Mostrar senha" });
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Space");
    await expect(secret).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute("aria-pressed", "true");
  });

  test("cadastro liga a mensagem de senha diferente ao campo", async ({ kurio, page }) => {
    await kurio.open("/register");
    await page.getByRole("textbox", { name: "Nome de usuário" }).fill("Teclado");
    await page.getByRole("textbox", { name: "Digite seu e-mail" }).fill("teclado@kurio.test");
    await page.getByLabel("Senha", { exact: true }).fill("Teclado#2026");
    const confirm = page.getByLabel("Confirmar senha", { exact: true });
    await confirm.fill("Outra#2026");
    await confirm.press("Enter");

    await expect(confirm).toHaveAttribute("aria-invalid", "true");
    await expect(confirm).toHaveAccessibleDescription("As senhas não conferem.");
  });

  test("quantidade do detalhe é validada com aria-invalid e descrição", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${SEED.firstNft.slug}`);
    await kurio.expectDetailLoaded();
    const quantity = page.getByRole("spinbutton");

    await quantity.fill("9");
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    await expect(quantity).toHaveAccessibleDescription("Informe uma quantidade inteira de 1 a 5.");

    await quantity.fill("2");
    await expect(quantity).toHaveAttribute("aria-invalid", "false");
    await page.getByRole("button", { name: "Aumentar quantidade" }).focus();
    await page.keyboard.press("Enter");
    await expect(quantity).toHaveValue("3");
    await page.getByRole("button", { name: "Diminuir quantidade" }).focus();
    await page.keyboard.press("Space");
    await expect(quantity).toHaveValue("2");
  });

  test("cupom do carrinho envia com Enter e liga o erro ao campo", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.addToCart(SEED.second.slug);
    await page.goto("/cart");
    const coupon = page.getByRole("textbox", { name: "Código promocional" });

    await coupon.focus();
    await page.keyboard.type("INEXISTENTE");
    await page.keyboard.press("Enter");
    await expect(coupon).toHaveAttribute("aria-invalid", "true");
    await expect(coupon).toHaveAccessibleDescription("Cupom inválido.");

    await coupon.fill("DROP5");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Cupom DROP5 aplicado.")).toBeVisible();
  });

  test("no pagamento, as carteiras e a aprovação funcionam pelo teclado", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart(SEED.second.slug);
    await page.goto("/checkout");
    await expect(page.getByRole("list", { name: "Carteiras" })).toBeVisible();

    // Os rádios das carteiras escolhem com as setas.
    const first = page.getByRole("radio", { name: /Carteira principal/ });
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: /Carteira Polygon/ })).toBeChecked();

    const connect = page.getByRole("button", { name: "Conectar Carteira Polygon" });
    await connect.focus();
    await page.keyboard.press("Enter");
    const approve = page.getByRole("button", { name: "Aprovar conexão" });
    await expect(approve).toBeVisible();
    await tabTo(page, "Aprovar conexão");
    await expect(approve).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Desconectar Carteira Polygon" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
  });

  test("perfil: Enter envia, erros ficam ligados aos campos e Tab segue a ordem visual", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/account/profile");
    const name = page.getByRole("main").getByRole("textbox", { name: "Nome de exibição" });
    await expect(name).toHaveValue(USERS.marina.name);

    await name.fill("");
    await name.press("Enter");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAccessibleDescription("Informe seu nome de exibição.");

    await name.fill("Marina Alves");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("main").getByRole("textbox", { name: "Nome de usuário" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toBeFocused();
  });
});
