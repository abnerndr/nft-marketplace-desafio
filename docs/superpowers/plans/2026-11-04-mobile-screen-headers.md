# Mobile Screen Headers (Figma) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No mobile, reproduzir o padrão de topo do Figma (voltar + título centralizado; no detalhe NFT, voltar + favoritar) sem alterar o layout desktop.

**Architecture:** Extrair um `MobileScreenHeader` reutilizável (`lg:hidden`) e usá-lo nas telas com “Screen Header” no Figma. O Detalhe NFT usa a variante com `trailing` (favoritar). O shell deixa de renderizar `SiteHeader` compacto em todas as rotas mobile; a home mobile fica só com busca+filtro (frame `1:1531`). Desktop (`lg:` e acima) permanece intacto.

**Tech Stack:** React 19, TanStack Router, Tailwind 4, assets existentes em `src/assets/cart/`, Playwright e2e em viewport 390.

## Global Constraints

- Não alterar composição, classes ou markup desktop (`lg:` / `hidden lg:block` / breadcrumbs) — só mobile (`lg:hidden` / `max-lg:`).
- Frames Figma: Carrinho `1:1694` Screen Header (voltar + “Carrinho de NFTs”); Pagamento `1:1785` (voltar + “Pagamento com carteira”); Detalhes `1:1629` Frame 426 (voltar + heart, sem título no topo); Início `1:1531` (busca+filtro, sem voltar/título).
- Botão voltar: círculo 35px com `back-circle.svg` + `back-arrow.svg` (rotate-90), já usados em cart/payment.
- Título: `text-xl font-bold leading-4 text-foreground`, centralizado na barra de altura `h-11` / 44px.
- Detalhe: botões 35px circular `bg-[#2F1D15] border border-border`; favorito com `aria-pressed` e `useFavorite`.
- Não baixar assets temporários do MCP se já existirem localmente (`src/assets/cart/back-*.svg`, heart do detalhe).
- Commits com mensagem convencional curta; não alterar baselines visuais nesta entrega salvo se um e2e visual falhar por causa deste header (aí atualizar só o baseline afetado).

---

### Task 1: Componente `MobileScreenHeader`

**Files:**
- Create: `src/components/mobile-screen-header.tsx`
- Create: `e2e/specs/16-mobile-screen-headers.spec.ts`
- Modify: (nenhum ainda — só o componente + spec que falha até Task 2)

**Interfaces:**
- Consumes: `backArrow` / `backCircle` de `@/assets/cart/`; `Link` ou `button` via props `backTo` / `onBack`.
- Produces:

```tsx
type MobileScreenHeaderProps = {
  title?: string;
  /** Destino do voltar. Se omitido e `onBack` também, usa `router.history.back()`. */
  backTo?: string;
  backAriaLabel?: string;
  onBack?: () => void;
  /** Slot direito (ex.: favoritar no detalhe). Reserva 35px à esquerda do título quando há título. */
  trailing?: React.ReactNode;
};
export function MobileScreenHeader(props: MobileScreenHeaderProps): JSX.Element;
```

- [ ] **Step 1: Write the failing e2e**

Criar `e2e/specs/16-mobile-screen-headers.spec.ts`:

```ts
import { expect, SEED, test } from "../fixtures";

test.describe("mobile screen headers (390)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("carrinho: voltar + título centralizado, sem SiteHeader desktop", async ({ kurio, page }) => {
    await kurio.open("/cart");
    const header = page.locator("header").filter({ hasText: "Carrinho de NFTs" });
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: /voltar/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "KURIO" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
  });

  test("pagamento: voltar + título Pagamento com carteira", async ({ kurio, page }) => {
    await kurio.login("marina");
    await kurio.addToCart(SEED.firstNft.slug);
    await page.goto("/checkout");
    const header = page.locator("header").filter({ hasText: "Pagamento com carteira" });
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: /voltar/i })).toBeVisible();
  });

  test("detalhe: voltar + favoritar no topo, sem título de página no header", async ({ kurio, page }) => {
    await page.goto(`/nfts/${SEED.firstNft.slug}`);
    await kurio.expectDetailLoaded();
    await expect(page.getByRole("link", { name: /voltar/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /favoritar|favoritos/i }).first()).toBeVisible();
    // Não deve haver barra “Início” / KURIO acima do hero mobile
    await expect(page.getByRole("link", { name: "KURIO" })).toHaveCount(0);
  });

  test("início mobile: busca Explorar coleções sem título Início com voltar", async ({ kurio, page }) => {
    await kurio.open("/");
    await expect(page.getByRole("searchbox", { name: /explorar coleções/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Voltar" })).toHaveCount(0);
    await expect(page.locator("header").filter({ hasText: /^Início$/ })).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run e2e to verify it fails (or partially fails)**

Run: `npm run test:e2e -- e2e/specs/16-mobile-screen-headers.spec.ts --project=chromium-mobile 2>&1 | tail -40`

Se o projeto Playwright não tiver `chromium-mobile`, use o projeto que aplica viewport 390 (ou rode sem `--project` e confie no `test.use` viewport). Esperado: pelo menos 1 falha (header global KURIO ainda presente no HEAD commitado, ou título Início no WIP).

- [ ] **Step 3: Implement `MobileScreenHeader`**

```tsx
import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import backArrow from "@/assets/cart/back-arrow.svg";
import backCircle from "@/assets/cart/back-circle.svg";

type MobileScreenHeaderProps = {
  title?: string;
  backTo?: string;
  backAriaLabel?: string;
  onBack?: () => void;
  trailing?: ReactNode;
};

export function MobileScreenHeader({
  title,
  backTo,
  backAriaLabel = "Voltar",
  onBack,
  trailing,
}: MobileScreenHeaderProps) {
  const router = useRouter();

  const backClass =
    "relative flex size-[35px] shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-primary";
  const backInner = (
    <>
      <img src={backCircle} alt="" className="absolute inset-0 size-[35px]" />
      <img src={backArrow} alt="" className="relative rotate-90" />
    </>
  );

  return (
    <header className="relative flex h-11 w-full items-center lg:hidden">
      {backTo ? (
        <Link to={backTo} aria-label={backAriaLabel} className={backClass}>
          {backInner}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={backAriaLabel}
          className={backClass}
          onClick={() => (onBack ? onBack() : router.history.back())}
        >
          {backInner}
        </button>
      )}
      {title ? (
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-xl font-bold leading-4 text-foreground">
          {title}
        </h1>
      ) : null}
      <div className="ml-auto flex size-[35px] shrink-0 items-center justify-center">{trailing ?? null}</div>
    </header>
  );
}
```

Nota: o slot `trailing` vazio (35px) equilibra o título centralizado quando não há favorito — igual ao `pr-[35px]` atual do carrinho.

- [ ] **Step 4: Commit**

```bash
git add src/components/mobile-screen-header.tsx e2e/specs/16-mobile-screen-headers.spec.ts
git commit -m "$(cat <<'EOF'
feat: add MobileScreenHeader for Figma mobile tops

EOF
)"
```

---

### Task 2: Shell + páginas (cart, payment, detail, home)

**Files:**
- Modify: `src/app/shell.tsx` — não renderizar `SiteHeader` compacto no mobile; desktop intacto (`hidden lg:block`).
- Modify: `src/features/cart/cart-page.tsx` — trocar header mobile inline por `<MobileScreenHeader title="Carrinho de NFTs" backTo="/" backAriaLabel="Voltar ao catálogo" />`.
- Modify: `src/features/checkout/payment-page.tsx` — idem com `title="Pagamento com carteira" backTo="/cart"`.
- Modify: `src/features/nft/detail-page.tsx` — no bloco `lg:hidden` do topo, usar `MobileScreenHeader` **sem** `title`, com `trailing` = botão favoritar existente; desktop breadcrumb intacto.
- Modify: `src/features/catalog/home-page.tsx` / `src/components/site-header.tsx` — compact mobile = **só** busca “Explorar coleções” + filtro (sem voltar, sem título “Início”). `SiteHeader` compact fica só na home via `lg:hidden` local, não no shell.
- Modify: `src/components/mobile-navigation.tsx` se o WIP já alinhou ícones — manter bottom nav só onde o shell/Figma pede (home); não reintroduzir chrome desktop no mobile.

**Interfaces:**
- Consumes: `MobileScreenHeader` da Task 1; `useFavorite` no detalhe.
- Produces: páginas mobile com headers do Figma; desktop sem diff visual.

- [ ] **Step 1: Aplicar shell**

Em `shell.tsx`, garantir:

```tsx
<div className={auth ? "hidden lg:block" : "contents"}>
  <div className="hidden lg:block">
    <SiteHeader cartCount={cartCount} />
  </div>
</div>
```

Não renderizar `<SiteHeader compact />` no shell. Bottom nav: `{pathname === "/" ? <MobileNavigation /> : null}` (frame início) — não em auth/cart/detail.

- [ ] **Step 2: Cart + payment**

Substituir o bloco:

```tsx
<header className="flex h-11 items-center lg:hidden">...</header>
```

por:

```tsx
<MobileScreenHeader title="Carrinho de NFTs" backTo="/" backAriaLabel="Voltar ao catálogo" />
```

e no payment:

```tsx
<MobileScreenHeader title="Pagamento com carteira" backTo="/cart" backAriaLabel="Voltar ao carrinho" />
```

Manter `h1.sr-only.max-lg:hidden` / breadcrumbs `hidden lg:block` como estão.

- [ ] **Step 3: Detail trailing favorite**

```tsx
<MobileScreenHeader
  backTo="/"
  backAriaLabel="Voltar ao catálogo"
  trailing={
    <button
      type="button"
      aria-label={favorite.isFavorite ? "Remover dos favoritos" : "Favoritar"}
      aria-pressed={favorite.isFavorite}
      onClick={favorite.toggle}
      disabled={favorite.isPending}
      className={`flex size-[35px] items-center justify-center rounded-full border border-border disabled:opacity-60 ${
        favorite.isFavorite ? "bg-primary/30" : "bg-[#2F1D15]"
      }`}
    >
      <img src={heartSmall} alt="" />
    </button>
  }
/>
```

Não colocar o título da NFT no header mobile (fica no sheet, frame `1:1648`).

- [ ] **Step 4: Home compact sem Início/voltar**

No ramo `compact` de `site-header.tsx`, remover a linha com botão Voltar + `<p>Início</p>`. Manter só o `<form role="search">` com Explorar coleções + botão Filtros. Home continua a montar `<SiteHeader compact … />` em `home-page.tsx` dentro de `lg:hidden`.

- [ ] **Step 5: Run e2e 16 + typecheck**

```bash
npm run typecheck
npm run test:e2e -- e2e/specs/16-mobile-screen-headers.spec.ts
```

Esperado: typecheck OK; 4/4 specs passando.

- [ ] **Step 6: Commit**

```bash
git add src/app/shell.tsx src/components/site-header.tsx src/components/mobile-navigation.tsx \
  src/features/cart/cart-page.tsx src/features/checkout/payment-page.tsx \
  src/features/nft/detail-page.tsx src/features/catalog/home-page.tsx \
  src/assets/mobile-nav src/assets/home/hero-dots-mobile.svg
# incluir só assets/arquivos tocados por este alinhamento mobile; não forçar auth/gallery se não forem do header
git commit -m "$(cat <<'EOF'
feat: wire Figma mobile screen headers without desktop changes

EOF
)"
```

---

### Task 3: Verificação desktop intacta + smoke

**Files:**
- Test: `e2e/specs/16-mobile-screen-headers.spec.ts` (adicionar caso desktop) e/ou rodar smoke existente

- [ ] **Step 1: Extender spec com guard desktop**

```ts
test.describe("desktop unchanged at 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("detalhe e carrinho mantêm breadcrumb e header KURIO", async ({ kurio, page }) => {
    await kurio.open(`/nfts/${SEED.firstNft.slug}`);
    await expect(page.getByRole("link", { name: "KURIO" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegação estrutural" })).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByRole("navigation", { name: "Navegação estrutural" })).toContainText("Carrinho");
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Rodar specs 02, 05 e 16**

```bash
npm run test:e2e -- e2e/specs/02-detalhe.spec.ts e2e/specs/05-carrinho.spec.ts e2e/specs/16-mobile-screen-headers.spec.ts
```

Esperado: todos passando.

- [ ] **Step 3: Commit se houve alteração na spec**

```bash
git add e2e/specs/16-mobile-screen-headers.spec.ts
git commit -m "$(cat <<'EOF'
test: assert desktop chrome untouched beside mobile headers

EOF
)"
```

---

## Self-Review

1. Spec coverage: voltar+título (cart/payment), voltar+favorito (detail), home sem esse padrão, desktop intacto — Tasks 1–3.
2. Sem placeholders.
3. `MobileScreenHeader` props estáveis entre tasks.
