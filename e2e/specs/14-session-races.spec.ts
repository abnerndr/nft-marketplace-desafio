import type { Page } from "@playwright/test";
import { expect, test, USERS } from "../fixtures";

/**
 * `page.route` não observa o fetch que o service worker do MSW responde sozinho
 * (o app segue funcionando com a lista de rotas vazia). O atraso fica no
 * `onloadend` do XHR: o mock já gravou o status, e o Axios só lê a resposta
 * quando o teste libera. Nada é escrito no cache do React Query para forjar a corrida.
 * A troca de conta até a liberação usa só navegação da SPA.
 */

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

type HeldResponse = { path: string; status: number };

test.use({ trace: "off" });

test.describe("respostas tardias não atravessam a troca de conta", () => {
  test("perfil e sessão processados na conta anterior não substituem a conta nova", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/account/profile");
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue(USERS.marina.email);

    await installLateResponses(page, false);
    await startStaleAccountWrites(page);
    await expectProcessed(page, 200);
    await expect(page.getByText("Alterações salvas.")).toHaveCount(0);
    await expect(page.getByRole("img", { name: /Avatar de/ })).toHaveCount(0);

    await switchToRafael(page);
    await releaseLateResponses(page);
    await expectAccountUnchanged(page);
  });

  test("401 processado na conta anterior não encerra a sessão da conta nova", async ({ kurio, page }) => {
    await kurio.open("/");
    await kurio.login("marina");
    await page.goto("/account/profile");
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue(USERS.marina.email);

    await installLateResponses(page, true);
    await kurio.switchScenario("session-expired");
    await startStaleAccountWrites(page);
    await expectProcessed(page, 401);
    await kurio.switchScenario("default");
    await expect(page.getByText("Alterações salvas.")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue(USERS.marina.email);

    await switchToRafael(page);
    await releaseLateResponses(page);
    await expectAccountUnchanged(page);
  });
});

async function startStaleAccountWrites(page: Page) {
  const main = page.getByRole("main");
  await main.getByRole("textbox", { name: "Nome de exibição" }).fill("Sessão Antiga");
  await main.getByRole("button", { name: "Salvar", exact: true }).click();
  await main.locator("input[type=file]").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await page.evaluate(async () => {
    const specifier = "/src/shared/api/query-client.ts";
    const load = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<{ queryClient: { refetchQueries: (filters: { queryKey: readonly string[] }) => Promise<unknown> } }>;
    const mod = await load(specifier);
    void mod.queryClient.refetchQueries({ queryKey: ["session"] });
  });
}

async function expectProcessed(page: Page, status: number) {
  await expect.poll(() => heldResponses(page)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "/api/profile", status }),
      expect.objectContaining({ path: "/api/profile/avatar", status }),
      expect.objectContaining({ path: "/api/auth/session", status }),
    ]),
  );
}

/** Sai, entra como Rafael e abre o perfil sem recarregar o documento. */
async function switchToRafael(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/$/);
  // Desktop: link "Entrar" no header. Mobile: nav inferior ou rota direta.
  const entrar = page.getByRole("link", { name: "Entrar", exact: true });
  if (await entrar.count()) {
    await entrar.first().click();
  } else {
    await page.goto("/login");
  }
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("textbox", { name: "contato@email.com" }).fill(USERS.rafael.email);
  await page.getByLabel("Senha", { exact: true }).fill(USERS.rafael.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const profileLink = page.getByRole("link", { name: USERS.rafael.name });
  if (await profileLink.count()) {
    await profileLink.first().click();
  } else {
    await page.goto("/account/profile");
  }
  await expect(page).toHaveURL(/\/account\/profile$/);
  await expect(page.getByRole("main").getByRole("textbox", { name: "E-mail" })).toHaveValue(USERS.rafael.email);
  expect(await sessionOwner(page)).toBe("user-rafael");
}

async function expectAccountUnchanged(page: Page) {
  const drifted = await page
    .waitForFunction(
      (email) => {
        const field = document.querySelector("main input[name=email]");
        const value = field instanceof HTMLInputElement ? field.value : "";
        const token = window.localStorage.getItem("kurio.session");
        const raw = window.localStorage.getItem("kurio.mock");
        let owner: string | null = null;
        if (token && raw) {
          try {
            const sessions = (JSON.parse(raw) as { db?: { sessions?: Record<string, string> } }).db?.sessions ?? {};
            owner = sessions[token] ?? null;
          } catch {
            owner = null;
          }
        }
        const intact = !window.location.pathname.startsWith("/login") && value === email && owner === "user-rafael";
        return !intact;
      },
      USERS.rafael.email,
      { timeout: 1_500 },
    )
    .then(() => true)
    .catch(() => false);

  const email = await page
    .getByRole("main")
    .getByRole("textbox", { name: "E-mail" })
    .inputValue()
    .catch(() => "");
  // Desktop mostra o nome no header; no mobile a conta vive na nav inferior ("Conta").
  const account =
    (await page.getByRole("link", { name: USERS.rafael.name }).count()) +
    (await page.getByRole("navigation", { name: "Navegação mobile" }).getByRole("link", { name: "Conta" }).count());
  expect({
    drifted,
    email,
    account: account > 0 ? 1 : 0,
    owner: await sessionOwner(page),
    pathname: new URL(page.url()).pathname,
  }).toEqual({
    drifted: false,
    email: USERS.rafael.email,
    account: 1,
    owner: "user-rafael",
    pathname: "/account/profile",
  });
}

async function sessionOwner(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const token = window.localStorage.getItem("kurio.session");
    const raw = window.localStorage.getItem("kurio.mock");
    if (!token || !raw) return null;
    try {
      const sessions = (JSON.parse(raw) as { db?: { sessions?: Record<string, string> } }).db?.sessions ?? {};
      return sessions[token] ?? null;
    } catch {
      return null;
    }
  });
}

async function heldResponses(page: Page): Promise<HeldResponse[]> {
  return page.evaluate(() => (window as Window & { __kurioHeld?: HeldResponse[] }).__kurioHeld ?? []);
}

async function releaseLateResponses(page: Page) {
  await page.evaluate(() => {
    (window as Window & { __kurioRelease?: () => void }).__kurioRelease?.();
  });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)));
      }),
  );
}

/**
 * Segura a entrega ao Axios. `holdAll` também retém os outros XHR da conta,
 * para um 401 paralelo não expirar a sessão antes da troca. O logout segue livre.
 */
async function installLateResponses(page: Page, holdAll: boolean) {
  await page.evaluate((retainAll) => {
    const token = window.localStorage.getItem("kurio.session");
    if (!token) throw new Error("sem sessão para segurar");
    const held: { path: string; status: number }[] = [];
    const release: Array<() => void> = [];
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSet = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function open(method: string, url: string | URL, ...rest: never[]) {
      Object.defineProperty(this, "__method", { value: String(method) });
      Object.defineProperty(this, "__url", { value: String(url) });
      return originalOpen.apply(this, [method, url, ...rest] as unknown as Parameters<XMLHttpRequest["open"]>);
    };
    XMLHttpRequest.prototype.setRequestHeader = function setRequestHeader(name: string, value: string) {
      if (name.toLowerCase() === "authorization") Object.defineProperty(this, "__auth", { value });
      return originalSet.call(this, name, value);
    };
    XMLHttpRequest.prototype.send = function send(body?: Document | XMLHttpRequestBodyInit | null) {
      const xhr = this as XMLHttpRequest & { __method?: string; __url?: string; __auth?: string };
      const path = new URL(xhr.__url ?? "", window.location.origin).pathname;
      const method = xhr.__method ?? "";
      const owned = xhr.__auth === `Bearer ${token}`;
      const tracked =
        (method === "PATCH" && path === "/api/profile") ||
        (method === "POST" && path === "/api/profile/avatar") ||
        (method === "GET" && path === "/api/auth/session");
      const logout = method === "POST" && path === "/api/auth/logout";
      if (!owned || logout || (!tracked && !retainAll)) return originalSend.call(this, body ?? null);

      const notify = xhr.onloadend;
      xhr.onloadend = () => {
        held.push({ path, status: xhr.status });
        release.push(() => notify?.call(xhr, new ProgressEvent("loadend")));
      };
      return originalSend.call(this, body ?? null);
    };

    Object.assign(window, {
      __kurioHeld: held,
      __kurioRelease() {
        const batch = release.splice(0);
        for (const fire of batch) fire();
      },
    });
  }, holdAll);
}
