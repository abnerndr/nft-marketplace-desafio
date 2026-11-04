import type { Page } from "@playwright/test";
import { expect, SEED, test, type Kurio } from "../fixtures";

const SAGE = SEED.second;
const notice = (page: Page) => page.getByTestId("price-notice");
const MARINA = "user-marina";

function nftEvent(id: string, version: number, priceEth: string, userId: string | undefined = MARINA) {
  return { eventId: id, version, ...(userId ? { userId } : {}), resource: { slug: SAGE.slug, priceEth } };
}

async function cartWithSage(kurio: Kurio, page: Page) {
  await kurio.open("/");
  await kurio.login("marina");
  await kurio.addToCart(SAGE.slug);
  await page.goto("/cart");
  await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText("1.69 ETH");
}

/**
 * Pedido que o servidor gravou, mas cuja resposta se perdeu (`order-timeout`): a segunda tentativa,
 * com a mesma chave, devolve o pedido pendente e abre a página dele. A página fica pendente por
 * alguns segundos (rede lenta) até a segunda leitura confirmar.
 */
async function placePendingOrder(kurio: Kurio, page: Page): Promise<string> {
  await kurio.checkoutReady("marina", SAGE.slug);
  await kurio.switchScenario("order-timeout");
  const confirm = page.getByRole("button", { name: "Confirmar compra" });
  await confirm.click();
  await expect(page.getByRole("alert").filter({ hasText: "Sem resposta do servidor" })).toBeVisible({ timeout: 5_000 });
  // Rede lenta alarga a janela em que o pedido fica pendente: o servidor só o confirma na segunda leitura.
  await kurio.switchScenario("slow-network");
  await confirm.click();
  await expect(page).toHaveURL(/\/orders\/order-/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

test.describe("eventos duplicados ou antigos, API indisponível e pedido pendente", () => {
  test("evento duplicado não é aplicado de novo", async ({ kurio, page }) => {
    await cartWithSage(kurio, page);

    await kurio.emit("nft.updated", nftEvent("evt-e2e-dup", 2, "2.00"));
    await expect(notice(page)).toContainText("de 1.69 ETH para 2 ETH");
    await notice(page).getByRole("button", { name: "Entendi" }).click();

    // Mesmo eventId com versão e preço mais novos: o cliente já viu o id e ignora.
    await kurio.emit("nft.updated", nftEvent("evt-e2e-dup", 3, "3.00"));
    // O evento seguinte, novo de verdade, parte do 2 ETH: o 3.00 nunca entrou no cache.
    await kurio.emit("nft.updated", nftEvent("evt-e2e-next", 4, "4.00"));
    await expect(notice(page)).toHaveCount(1);
    await expect(notice(page)).toContainText("de 2 ETH para 4 ETH");
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText("4 ETH");
  });

  test("evento com versão antiga é ignorado", async ({ kurio, page }) => {
    await cartWithSage(kurio, page);

    await kurio.emit("nft.updated", nftEvent("evt-e2e-v5", 5, "5.00"));
    await expect(notice(page)).toContainText("de 1.69 ETH para 5 ETH");

    await kurio.emit("nft.updated", nftEvent("evt-e2e-v3", 3, "3.00"));
    await kurio.emit("nft.updated", nftEvent("evt-e2e-v6", 6, "6.00"));
    await expect(notice(page)).toHaveCount(1);
    await expect(notice(page)).toContainText("de 5 ETH para 6 ETH");
    await expect(notice(page)).not.toContainText("3 ETH");
  });

  test("evento de outra sessão e evento malformado não mexem no cache", async ({ kurio, page }) => {
    await cartWithSage(kurio, page);

    await kurio.emit("nft.updated", nftEvent("evt-e2e-other", 2, "9.00", "user-rafael"));
    await kurio.emit("nft.updated", { eventId: "evt-e2e-bad", version: "x", resource: {} });
    await kurio.emit("nft.updated", nftEvent("evt-e2e-mine", 3, "2.50"));
    await expect(notice(page)).toHaveCount(1);
    await expect(notice(page)).toContainText("de 1.69 ETH para 2.5 ETH");
    await expect(page.getByRole("list", { name: "Itens do carrinho" })).toContainText("2.5 ETH");
  });

  test("order.updated do servidor conclui o pedido pendente e evento antigo não o desfaz", async ({ kurio, page }) => {
    test.setTimeout(60_000);
    const orderId = await placePendingOrder(kurio, page);
    const txRef = `0x${"ab".repeat(32)}`;

    await kurio.emit("order.updated", { eventId: "evt-e2e-order-2", version: 2, userId: MARINA, resource: { id: orderId, status: "confirmed", txRef } });
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    await expect(page.getByText("0xABAB…ABAB")).toBeVisible();

    // Evento antigo (pendente, versão 1) chega depois; um evento de preço serve de marcador de ordem.
    await kurio.emit("order.updated", { eventId: "evt-e2e-order-1", version: 1, userId: MARINA, resource: { id: orderId, status: "pending", txRef: null } });
    await kurio.emit("nft.updated");
    await expect(notice(page)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    await expect(page.getByText("Aguardando confirmação")).toHaveCount(0);
    await expect(page.getByText("0xABAB…ABAB")).toBeVisible();
  });

  test("API indisponível (REST offline) com pedido pendente mostra o erro e a nova tentativa retoma o mesmo pedido", async ({ kurio, page }) => {
    // O mock não tem gancho para derrubar o WebSocket: este caso é a queda do REST (cenário offline) e a retomada.
    test.setTimeout(60_000);
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/orders") posts.push(request.url());
    });
    const orderId = await placePendingOrder(kurio, page);
    await kurio.switchScenario("offline");

    await expect(page.getByRole("alert").filter({ hasText: "Não foi possível carregar o pedido" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toHaveCount(0);

    await kurio.switchScenario("default");
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();

    // Nenhum pedido novo: só as duas tentativas do pagamento, e o pedido confirmado é o mesmo.
    expect(posts).toHaveLength(2);
    const db = await kurio.db();
    expect(db.orders.map((order) => order.id)).toEqual([orderId]);
    expect(db.orders[0].status).toBe("confirmed");
  });

  test("recarregar a página do pedido pendente retoma e confirma o mesmo pedido", async ({ kurio, page }) => {
    test.setTimeout(60_000);
    const orderId = await placePendingOrder(kurio, page);

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
    await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible();
    const db = await kurio.db();
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].status).toBe("confirmed");
  });
});
