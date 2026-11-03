import { expect, SEED, test, USERS } from "../fixtures";

test.describe("autenticação: cadastro, login, expiração, logout e troca de usuário", () => {
  test("cadastra uma conta nova, entra e mantém a sessão depois de recarregar", async ({ kurio, page }) => {
    await kurio.open("/register");
    await page.getByRole("textbox", { name: "Nome de usuário" }).fill("Clara Nunes");
    await page.getByRole("textbox", { name: "Digite seu e-mail" }).fill("clara@kurio.test");
    await page.getByLabel("Senha", { exact: true }).fill("Clara#2026");
    await page.getByLabel("Confirmar senha", { exact: true }).fill("Clara#2026");
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();

    await expect(page).not.toHaveURL(/\/register/);
    await page.goto("/account/profile");
    await expect(page.getByRole("heading", { name: "Perfil do colecionador" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue("clara@kurio.test");

    await page.reload();
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue("clara@kurio.test");
  });

  test("cadastro mostra erro de senha diferente, senha curta e e-mail repetido", async ({ kurio, page }) => {
    await kurio.open("/register");
    const submit = page.getByRole("button", { name: "Criar conta", exact: true });

    await page.getByRole("textbox", { name: "Nome de usuário" }).fill("Outra Marina");
    await page.getByRole("textbox", { name: "Digite seu e-mail" }).fill(USERS.marina.email);
    await page.getByLabel("Senha", { exact: true }).fill("Outra#2026");
    await page.getByLabel("Confirmar senha", { exact: true }).fill("Diferente#2026");
    await submit.click();
    await expect(page.getByText("As senhas não conferem.")).toBeVisible();

    await page.getByLabel("Confirmar senha", { exact: true }).fill("Outra#2026");
    await submit.click();
    await expect(page.getByText("Já existe uma conta com este e-mail.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Digite seu e-mail" })).toHaveAttribute("aria-invalid", "true");

    await page.getByRole("textbox", { name: "Digite seu e-mail" }).fill("curta@kurio.test");
    await page.getByLabel("Senha", { exact: true }).fill("curta");
    await page.getByLabel("Confirmar senha", { exact: true }).fill("curta");
    await submit.click();
    await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("login recusa credenciais erradas e campos vazios", async ({ kurio, page }) => {
    await kurio.open("/login");
    const submit = page.getByRole("button", { name: "Entrar", exact: true });

    await submit.click();
    await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
    await expect(page.getByText("Informe sua senha.")).toBeVisible();

    await page.getByRole("textbox", { name: "contato@email.com" }).fill(USERS.marina.email);
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
    await submit.click();
    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Senha", { exact: true }).fill(USERS.marina.password);
    await submit.click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("rota privada manda para o login e volta ao destino depois de entrar", async ({ kurio, page }) => {
    await kurio.open("/");
    await page.goto("/account/wallets");
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Fwallets/);

    await page.getByRole("textbox", { name: "contato@email.com" }).fill(USERS.rafael.email);
    await page.getByLabel("Senha", { exact: true }).fill(USERS.rafael.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/account\/wallets$/);
    await expect(page.getByRole("heading", { name: "Carteira principal" })).toBeVisible();
  });

  test("redirect externo é ignorado e o login cai na home", async ({ kurio, page }) => {
    await kurio.open("/login?redirect=//evil.example.com");
    await expect(page).not.toHaveURL(/evil/);
    await page.getByRole("textbox", { name: "contato@email.com" }).fill(USERS.marina.email);
    await page.getByLabel("Senha", { exact: true }).fill(USERS.marina.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:5173\/(#.*)?$/);
  });

  test("sessão expirada derruba o acesso à área privada e um novo login recupera", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/account/profile");
    await expect(page.getByRole("heading", { name: "Perfil do colecionador" })).toBeVisible();

    await kurio.setScenario("session-expired");
    await page.reload();
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Fprofile/);
    expect(await page.evaluate(() => window.localStorage.getItem("kurio.session"))).toBeNull();

    await kurio.setScenario("default");
    await page.getByRole("textbox", { name: "contato@email.com" }).fill(USERS.marina.email);
    await page.getByLabel("Senha", { exact: true }).fill(USERS.marina.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/account\/profile$/);
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue(USERS.marina.email);
  });

  test("cenário session-expired desde o início não deixa abrir a área privada", async ({ kurio, page }) => {
    await kurio.open("/", { scenario: "session-expired" });
    await page.goto("/account/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout encerra a sessão e a área privada volta a pedir login", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/account/profile");
    await expect(page.getByRole("heading", { name: "Perfil do colecionador" })).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => window.localStorage.getItem("kurio.session"))).toBeNull();
    expect(Object.keys((await kurio.db()).sessions)).toHaveLength(0);

    await page.goto("/account/profile");
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test("troca de usuário não herda favoritos, carrinho nem perfil do anterior", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await kurio.addToCart(SEED.second.slug);
    await page.goto("/cart");
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText(SEED.second.title);
    await page.goto("/account/profile");
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue(USERS.marina.email);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);

    await kurio.login("rafael");
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
    await page.goto("/account/profile");
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue(USERS.rafael.email);
    await expect(page.getByRole("main").getByRole("textbox", { name: "Nome de exibição" })).toHaveValue(USERS.rafael.name);

    // O favorito da Marina não aparece para o Rafael.
    await page.goto("/");
    const card = page.locator("#catalogo-grade article", { hasText: SEED.firstNft.title });
    await expect(card.getByRole("button", { name: `Favoritar ${SEED.firstNft.title}` })).toHaveAttribute("aria-pressed", "false");
  });
});
