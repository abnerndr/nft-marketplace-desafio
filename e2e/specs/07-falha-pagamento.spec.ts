import type { Page } from "@playwright/test";
import { expect, SEED, test, type Kurio, type ScenarioId } from "../fixtures";

const SAGE = SEED.second;

async function readyToPay(kurio: Kurio, page: Page, scenario?: ScenarioId) {
  await kurio.checkoutReady("marina", SAGE.slug);
  if (scenario) await kurio.switchScenario(scenario);
  await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
}

function orderRequests(page: Page): { key: string | undefined }[] {
  const seen: { key: string | undefined }[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/orders") {
      seen.push({ key: request.headers()["idempotency-key"] });
    }
  });
  return seen;
}

test.describe("falha de pagamento, clique repetido e timeout", () => {
  test("pagamento recusado não cobra, mantém o carrinho e permite tentar de novo", async ({ kurio, page }) => {
    await readyToPay(kurio, page, "payment-declined");
    await page.getByRole("button", { name: "Confirmar compra" }).click();

    await expect(page).toHaveURL(/\/orders\/order-/);
    await expect(page.getByRole("alert")).toContainText("Pagamento recusado");
    await expect(page.getByText("A carteira recusou o pagamento. Nada foi cobrado e os itens continuam no seu carrinho.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toHaveCount(0);

    const db = await kurio.db();
    expect(db.orders.map((order) => order.status)).toEqual(["declined"]);
    expect(db.carts["user-marina"].items).toHaveLength(1);

    // Recuperação: o pagamento volta a funcionar e a nova tentativa vira outro pedido, confirmado.
    await kurio.switchScenario("default");
    await page.getByRole("link", { name: "Tentar de novo" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("list", { name: "Carteiras" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    expect((await kurio.db()).orders.map((order) => order.status)).toEqual(["declined", "confirmed"]);
  });

  test("clique repetido em Confirmar compra cria um único pedido", async ({ kurio, page }) => {
    const requests = orderRequests(page);
    await readyToPay(kurio, page, "slow-network");
    const confirm = page.getByRole("button", { name: "Confirmar compra" });

    await confirm.dblclick();
    await expect(page.getByRole("button", { name: "Confirmando…" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible({ timeout: 15_000 });

    expect(requests).toHaveLength(1);
    expect((await kurio.db()).orders).toHaveLength(1);
  });

  test("timeout na confirmação reaproveita a chave e recupera o mesmo pedido", async ({ kurio, page }) => {
    test.setTimeout(60_000);
    const requests = orderRequests(page);
    await readyToPay(kurio, page, "order-timeout");
    const confirm = page.getByRole("button", { name: "Confirmar compra" });

    await confirm.click();
    await expect(page.getByRole("button", { name: "Confirmando…" })).toBeDisabled();
    // O servidor grava o pedido e só a resposta se perde (8 s do cenário).
    const failure = page.getByRole("alert").filter({ hasText: "Sem resposta do servidor" });
    await expect(failure).toBeVisible({ timeout: 20_000 });
    await expect(failure).toContainText("o pedido não será cobrado duas vezes");
    expect((await kurio.db()).orders).toHaveLength(1);
    const pendingId = (await kurio.db()).orders[0].id;
    expect((await kurio.db()).orders[0].status).toBe("pending");

    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page).toHaveURL(new RegExp(`/orders/${pendingId}$`));

    // Mesma chave nas duas tentativas e nenhum pedido novo.
    expect(requests).toHaveLength(2);
    expect(requests[0].key).toBeTruthy();
    expect(requests[1].key).toBe(requests[0].key);
    expect((await kurio.db()).orders).toHaveLength(1);

    // O pedido pendente se resolve sozinho: o servidor confirma na segunda leitura.
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    expect((await kurio.db()).orders[0].status).toBe("confirmed");
    expect((await kurio.db()).orders).toHaveLength(1);
  });

  test("timeout + mudança de preço/carteira recupera o mesmo pedido sem segunda compra", async ({ kurio, page }) => {
    test.setTimeout(60_000);
    await readyToPay(kurio, page, "order-timeout");
    const confirm = page.getByRole("button", { name: "Confirmar compra" });
    await confirm.click();
    await expect(page.getByRole("alert").filter({ hasText: "Sem resposta do servidor" })).toBeVisible({
      timeout: 20_000,
    });
    const before = await kurio.db();
    expect(before.orders).toHaveLength(1);
    const snapshot = structuredClone(before.orders[0].snapshot);

    await kurio.switchScenario("price-changed");
    const secondary = page.getByRole("list", { name: "Carteiras" }).getByRole("listitem").nth(1);
    if (await secondary.count()) {
      await secondary.click();
    }

    await confirm.click();
    await expect(page).toHaveURL(/\/orders\/order-/);
    const after = await kurio.db();
    expect(after.orders).toHaveLength(1);
    expect(after.orders[0].id).toBe(before.orders[0].id);
    expect(after.orders[0].snapshot).toEqual(snapshot);
  });
});
