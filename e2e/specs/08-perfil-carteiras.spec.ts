import type { Page } from "@playwright/test";
import { expect, test, USERS } from "../fixtures";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const main = (page: Page) => page.getByRole("main");
const field = (page: Page, name: string) => main(page).getByRole("textbox", { name });
const password = (page: Page, label: string) => main(page).getByLabel(label, { exact: true });
const save = (page: Page) => main(page).getByRole("button", { name: "Salvar", exact: true });

async function openProfile(kurio: import("../fixtures").Kurio, page: Page, user: "marina" | "rafael" = "marina") {
  await kurio.open("/");
  await kurio.login(user);
  await page.goto("/account/profile");
  await expect(field(page, "Nome de exibição")).toHaveValue(USERS[user].name);
}

test.describe("perfil, avatar, senha e carteiras", () => {
  test("valida o perfil no cliente e no servidor antes de salvar", async ({ kurio, page }) => {
    await openProfile(kurio, page);

    await field(page, "Nome de exibição").fill("");
    await field(page, "E-mail").fill("sem-arroba");
    await save(page).click();
    await expect(page.getByText("Informe seu nome de exibição.")).toBeVisible();
    await expect(page.getByText("Digite um e-mail válido.")).toBeVisible();
    await expect(field(page, "Nome de exibição")).toHaveAttribute("aria-invalid", "true");

    // O servidor recusa e-mail de outra conta e nome de usuário fora do padrão.
    await field(page, "Nome de exibição").fill("Marina A.");
    await field(page, "E-mail").fill(USERS.rafael.email);
    await field(page, "Nome de usuário").fill("a!");
    await save(page).click();
    await expect(page.getByText("Já existe uma conta com este e-mail.")).toBeVisible();
    await expect(page.getByText("Use de 3 a 30 letras, números, ponto, hífen ou sublinhado.")).toBeVisible();
    await expect(page.getByText("Alterações salvas.")).toHaveCount(0);
  });

  test("salva o perfil e os dados continuam depois de recarregar", async ({ kurio, page }) => {
    await openProfile(kurio, page);

    await field(page, "Nome de exibição").fill("Marina A. Alves");
    await field(page, "Nome de usuário").fill("marina.alves");
    await field(page, "Nome ENS").fill("marina-kurio");
    await field(page, "Apelido da carteira").fill("Carteira de colecionadora");
    await save(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Alterações salvas." })).toBeVisible();

    await page.reload();
    await expect(field(page, "Nome de exibição")).toHaveValue("Marina A. Alves");
    await expect(field(page, "Nome de usuário")).toHaveValue("marina.alves");
    await expect(field(page, "Nome ENS")).toHaveValue("marina-kurio");
    await expect(field(page, "Apelido da carteira")).toHaveValue("Carteira de colecionadora");
  });

  test("troca e remove o avatar e recusa arquivo inválido ou grande demais", async ({ kurio, page }) => {
    await openProfile(kurio, page);
    const input = main(page).locator("input[type=file]");

    await input.setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("não é imagem") });
    await expect(page.getByRole("alert")).toHaveText("Envie um arquivo de imagem.");

    await input.setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: Buffer.alloc(201 * 1024) });
    await expect(page.getByRole("alert")).toHaveText("A imagem pode ter no máximo 200 KB.");

    await input.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG_1X1 });
    const avatar = main(page).getByRole("img", { name: `Avatar de ${USERS.marina.name}` });
    await expect(avatar).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);

    await page.reload();
    await expect(avatar).toBeVisible();

    await main(page).getByRole("button", { name: "Remover", exact: true }).click();
    await expect(avatar).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: "Remover", exact: true })).toBeDisabled();
  });

  test("valida a troca de senha e depois entra com a senha nova", async ({ kurio, page }) => {
    await openProfile(kurio, page);

    await password(page, "Senha atual").fill("errada#123");
    await password(page, "Nova senha").fill("curta");
    await password(page, "Confirmar nova senha").fill("outra");
    await save(page).click();
    await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
    await expect(page.getByText("A confirmação não confere com a nova senha.")).toBeVisible();

    await password(page, "Nova senha").fill("Marina#2027");
    await password(page, "Confirmar nova senha").fill("Marina#2027");
    await save(page).click();
    await expect(page.getByText("A senha atual está incorreta.")).toBeVisible();
    await expect(page.getByText("Nenhuma alteração foi salva: corrija os campos de senha e salve de novo.")).toBeVisible();

    await password(page, "Senha atual").fill(USERS.marina.password);
    await save(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Perfil e senha salvos." })).toBeVisible();
    await expect(password(page, "Senha atual")).toHaveValue("");

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/login");
    await page.getByRole("textbox", { name: "contato@email.com" }).fill(USERS.marina.email);
    await page.getByLabel("Senha", { exact: true }).fill(USERS.marina.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
    await page.getByLabel("Senha", { exact: true }).fill("Marina#2027");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("lista as carteiras do seed e conecta e desconecta pela conta", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/account/wallets");
    await expect(page.getByRole("heading", { name: "Carteira principal" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Carteira principal salva" })).toContainText("Carteira principal");
    await expect(page.getByRole("list", { name: "Carteiras secundárias" })).toContainText("Carteira Polygon");
    await expect(page.getByRole("list", { name: "Carteira principal salva" })).toContainText("Desconectada");

    await page.getByRole("button", { name: "Conectar Carteira Polygon" }).click();
    await expect(page.getByRole("list", { name: "Carteiras secundárias" })).toContainText("Conectada");
    await expect(page.getByRole("button", { name: "Desconectar Carteira Polygon" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Desconectar Carteira Polygon" })).toBeVisible();
    await page.getByRole("button", { name: "Desconectar Carteira Polygon" }).click();
    await expect(page.getByRole("button", { name: "Conectar Carteira Polygon" })).toBeVisible();
  });

  test("cadastro de carteira mostra erros de validação e salva uma carteira nova", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("rafael");
    await page.goto("/account/wallets");
    await expect(page.getByText("Você ainda não adicionou uma carteira.")).toBeVisible();
    const form = page.getByRole("form", { name: "Adicionar carteira" });

    await form.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(form.getByText("Informe um nome para a carteira.")).toBeVisible();
    await expect(form.getByText("Escolha uma rede.")).toBeVisible();
    await expect(form.getByText("Informe o endereço da carteira.")).toBeVisible();
    await expect(form.getByText("Escolha uma carteira.")).toBeVisible();

    await form.getByRole("textbox", { name: "Nome de exibição" }).fill("Cofre do Rafael");
    await form.getByRole("combobox", { name: "Rede" }).selectOption("ethereum");
    await form.getByRole("combobox", { name: "Tipo de carteira" }).selectOption("metamask");
    await form.getByRole("textbox", { name: "Endereço da carteira" }).fill("0x123");
    await form.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(form.getByText("Endereço inválido para esta rede.")).toBeVisible();

    await form.getByRole("textbox", { name: "Endereço da carteira" }).fill("0x4a1c9be2d03f7a85c6e1b2f09d34a7c85e61f0b3");
    await form.getByRole("textbox", { name: "E-mail" }).fill("sem-arroba");
    await form.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(form.getByText("Digite um e-mail válido.")).toBeVisible();

    await form.getByRole("textbox", { name: "E-mail" }).fill("");
    await form.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Carteira salva." })).toBeVisible();
    await expect(page.getByRole("list", { name: "Carteira principal salva" })).toContainText("Cofre do Rafael");

    // A mesma carteira na mesma rede não entra duas vezes.
    await form.getByRole("textbox", { name: "Nome de exibição" }).fill("Cópia");
    await form.getByRole("combobox", { name: "Rede" }).selectOption("ethereum");
    await form.getByRole("combobox", { name: "Tipo de carteira" }).selectOption("metamask");
    await form.getByRole("textbox", { name: "Endereço da carteira" }).fill("0x4a1c9be2d03f7a85c6e1b2f09d34a7c85e61f0b3");
    await form.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(form.getByText("Esta carteira já está cadastrada.")).toBeVisible();
  });

  test("no pagamento a carteira recusada continua desconectada e a aprovada conecta", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart("sage-nomad-009");
    await page.goto("/checkout");

    await page.getByRole("button", { name: "Conectar Carteira principal" }).click();
    await expect(page.getByRole("region", { name: "Conectar Carteira principal" })).toBeVisible();
    await page.getByRole("button", { name: "Recusar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "A conexão foi recusada na carteira." })).toHaveAttribute("data-code", "wallet-connect-rejected");
    await expect(page.getByRole("button", { name: "Conectar Carteira principal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();

    await kurio.connectWallet("Carteira principal");
    await expect(page.getByRole("alert").filter({ hasText: "A conexão foi recusada na carteira." })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
  });

  test("no pagamento o formulário de carteira valida o endereço e adiciona a carteira", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("rafael");
    await kurio.addToCart("sage-nomad-009");
    await page.goto("/checkout");
    await expect(page.getByText("Nenhuma carteira ainda. Adicione uma abaixo.")).toBeVisible();
    const form = page.getByRole("form", { name: "Adicionar carteira" });

    await form.getByRole("button", { name: "Adicionar carteira" }).click();
    await expect(form.getByText("Informe um nome para a carteira.")).toBeVisible();
    await expect(form.getByText("Informe o endereço da carteira.")).toBeVisible();

    await form.getByRole("textbox", { name: "Nome de exibição" }).fill("Carteira do Rafael");
    await form.getByRole("textbox", { name: "Endereço da carteira" }).fill("endereco-invalido");
    await form.getByRole("button", { name: "Adicionar carteira" }).click();
    await expect(form.getByText("Endereço inválido para esta rede.")).toBeVisible();

    await form.getByRole("textbox", { name: "Endereço da carteira" }).fill("0x91be07c3a5d2e48f60b19c7d3a82e54f1c06ad27");
    await form.getByRole("button", { name: "Adicionar carteira" }).click();
    await expect(page.getByRole("list", { name: "Carteiras" })).toContainText("Carteira do Rafael");
    await kurio.connectWallet("Carteira do Rafael");
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
  });
});
