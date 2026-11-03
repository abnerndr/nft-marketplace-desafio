# Kurio Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o marketplace Kurio do desafio frontend, fiel ao Figma, com compra e conta simuladas por MSW e Socket.IO.

**Architecture:** SPA Vite. TanStack Router nas rotas e na proteção. TanStack Query no cache. Axios como único cliente REST. MSW intercepta REST e Socket.IO no browser, inclusive no build de demonstração. Valores em ETH são strings decimais. A UI adapta shadcn/ui aos tokens do Figma; cada tela parte de `get_design_context` do node indicado, não de um layout inventado.

**Tech Stack:** React, TypeScript, Vite, TanStack Router, TanStack Query, Axios, Tailwind CSS, shadcn/ui, MSW, `@mswjs/socket.io-binding`, `socket.io-client`, Zod, decimal.js, Playwright, Lighthouse.

**Figma:** fileKey `29GDGWiDm9YFc1IsHGrFby`. Antes de qualquer ferramenta de arquivo, chame `create_session` e reutilize o `sessionId`. Em `get_design_context`, passe `skillNames` `figma-design-to-code`, `clientLanguages` `typescript` e `clientFrameworks` `react`. Baixe os assets temporários para `src/assets` e não deixe URL do Figma no runtime.

## Global Constraints

- Interface em React e TypeScript. Roteamento com TanStack Router. Estado remoto com TanStack Query. HTTP somente via Axios. Tempo real com `socket.io-client`. Estilo com Tailwind. Componentes de interface com shadcn/ui adaptados à identidade. Mocks na camada de rede com MSW. E2E com Playwright. Auditoria com Lighthouse.
- APIs, autenticação, carteiras e pagamentos usam dados simulados. Sem blockchain, extensão de carteira ou gateway real.
- Layout de referência: Figma `29GDGWiDm9YFc1IsHGrFby`, frames abaixo. Desktop 1440, mobile 414 no arquivo. Avaliar também 390, 768 e 1440.
- Frames: Desktop Início `1:661`, Detalhes `1:844`, Carrinho `1:994`, Pagamento `1:1150`, Confirmação `1:1153`, Login `1:1248`, Cadastro `1:1282`, Perfil `1:1316`, Carteiras `1:1414`. Mobile Início `1:1531`, Detalhes `1:1629`, Carrinho `1:1694`, Pagamento `1:1785`, Login `1:1907`, Cadastro `1:1927`.
- Perfil, carteiras e confirmação funcionam em mobile mesmo sem frame próprio: empilhar a composição desktop, sem overflow horizontal.
- Páginas editoriais, suporte, atividade, ofertas e downloads não existem como rotas. A seção "Diário da Cunhagem" permanece visível na home. Os CTAs dessa seção e links auxiliares do rodapé não navegam para uma página que simule sucesso. Eles apontam para `#diario` na própria home.
- Busca, filtros, ordenação e paginação vivem na URL e sobrevivem a refresh e ao histórico. Mudança de filtro volta `page` para 1.
- ETH trafega e é calculado como string decimal. Quantidades são inteiras. A cotação da API é a referência para fechar o pedido.
- Favoritos persistem para o usuário autenticado.
- Carrinho sobrevive a refresh. Itens do visitante são preservados ao autenticar.
- Checkout, perfil, carteiras, favoritos e pedidos exigem autenticação.
- Sessão recuperável após refresh. Expiração no meio da navegação ou do checkout preserva o contexto para retomada. Logout e troca de usuário limpam cache privado e subscriptions da sessão anterior.
- Senhas não são armazenadas em claro. Fixtures guardam SHA-256. Credenciais fictícias: `marina@kurio.test` / `Marina#2026` e `rafael@kurio.test` / `Rafael#2026`.
- Mutations de pedido aceitam `Idempotency-Key`. A mesma chave e o mesmo corpo recuperam o mesmo pedido. A mesma chave com corpo diferente responde 409 `idempotency_conflict`.
- Eventos `nft.updated` e `order.updated` carregam `eventId`, recurso e `version`. Duplicata ou versão antiga não regride estado nem reaplica efeito. Depois de reconectar, reconciliar com REST. Evento de outra sessão não altera o usuário atual.
- Skeletons com shimmer no catálogo, detalhe e resumo do carrinho, com as dimensões finais do conteúdo. `prefers-reduced-motion` desliga o shimmer.
- Contagens do filtro no Figma (33, 12, 119…) são ilustração. A UI mostra as contagens devolvidas pela API.
- `letterSpacing: 10` nos estilos de 14px do Figma é porcentagem (0.1em) em rótulos, não 10px no texto corrido. Conferir no screenshot do node antes de aplicar.
- Tokens: ink `#140D0A`, foreground `#F5F1EB`, text-primary `#F7F3EC`, text-secondary `#CFB28C`, text-accent `#E89B55`, primary `#D28A4C`, secondary `#B39463`, surface-card `#241612`, surface-dark `#38220F`, border `#3F2319`, border-soft `#55321F`, background-elevated `#FBFBFB`. Fonte única: Roboto Mono (400, 500, 700), auto-hospedada com `@fontsource/roboto-mono`.
- Coleções da URL: `digital-art`, `photography`, `music`, `3d`, `collectibles`, `generative`, `games`, `subscriptions`, `utility`. Rótulos: Arte digital, Fotografia, Música, Arte 3D, Colecionáveis, Generativa, Jogos, Assinaturas, Utilidade.
- Redes: `ethereum`, `polygon`, `solana`.
- Ordenação: `recent` (rótulo "Listados recentemente"), `price_asc`, `price_desc`, `name`.
- Abas do catálogo: `all` "Todos os NFTs", `new` "Novos lançamentos", `trending` "Em alta".
- Página do catálogo tem 9 itens. Preço do slider em ETH, padrão visual `0.02`–`12.30`, aplicado só ao acionar "Aplicar".
- Cupons: `GENESIS10` desconto 10%, `DROP5` desconto 5%, `VENCIDO` expirado. Qualquer outro código é inválido.
- Cenários MSW, via `?scenario=` e painel: `default`, `empty`, `slow-network`, `out-of-order`, `offline`, `server-error`, `session-expired`, `validation-conflict`, `coupon-invalid`, `price-changed`, `edition-sold-out`, `order-timeout`, `payment-confirmed`, `payment-declined`. `?reset=1` restaura o seed. Estado em `localStorage` na chave `kurio.mock`.
- Erros da API usam o corpo `{ error: { code, message, fields? } }` com `code` em `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `unavailable`, `idempotency_conflict`.
- Atualização otimista obrigatória nos favoritos, com rollback se a mutation falhar.
- Não colocar respostas fictícias dentro de componentes, hooks ou do cliente Axios.

---

### Task 1: Scaffold da aplicação

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/index.css`, `src/app/providers.tsx`, `src/app/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/shared/api/client.ts`, `.env.example`, `.gitignore`
- Modify: nenhum
- Test: verificação por `npm run typecheck` e `npm run build` (a suíte Playwright entra na Task 14; não crie teste que só afirma `true`)

**Interfaces:**
- Consumes: nada
- Produces:
  - `src/shared/api/client.ts` exporta `api`, um `AxiosInstance` com `baseURL` lido de `import.meta.env.VITE_API_URL`, padrão `"/api"`.
  - `src/app/router.tsx` exporta `router`, um `createRouter` do TanStack Router. Rota `/` renderiza `<h1>Kurio</h1>`.
  - `src/app/providers.tsx` exporta `AppProviders`, que monta `QueryClientProvider` com um `QueryClient` (`retry: 1` em queries, `retry: 0` em mutations) e o `RouterProvider`.
  - Alias TypeScript e Vite `@` → `src`.

- [ ] **Step 1: Gerar o Vite sem apagar o enunciado nem este plano**

O diretório já contém `Desafio Frontend — Marketplace de NFTs.md` e `docs/`. Não rode `create vite` apontando para `.` se isso for sobrescrever esses arquivos.

```bash
npm create vite@latest /tmp/kurio-vite -- --template react-ts
cp -a /tmp/kurio-vite/. /home/abner/www/abnerndr/nft-marketplace-desafio/
```

Confirme que o markdown do desafio e `docs/superpowers/plans/2026-11-03-kurio-marketplace.md` continuam no disco.

- [ ] **Step 2: Dependências de runtime e Tailwind**

```bash
npm install
npm install @tanstack/react-router @tanstack/react-query axios
npm install -D tailwindcss @tailwindcss/vite
```

Em `vite.config.ts`, registre `@vitejs/plugin-react`, `@tailwindcss/vite` e o alias `@`.

```ts
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { port: 5173 },
});
```

Em `tsconfig.app.json`, acrescente `"paths": { "@/*": ["./src/*"] }` dentro de `compilerOptions` e mantenha o bundler resolution do template.

`src/index.css` fica só com:

```css
@import "tailwindcss";
```

- [ ] **Step 3: shadcn/ui sem trocar a paleta**

```bash
npx shadcn@latest init --help
```

Rode o init de forma não interativa. Escolha TypeScript, aliases `@/components`, `@/lib`, `@/hooks`, CSS variables e base neutra. Não aplique um preset que substitua as cores. Se o CLI exigir uma pergunta sem flag, responda com esses valores. Não adicione componentes além do que o init gera (`lib/utils.ts` com `cn` é esperado).

- [ ] **Step 4: Cliente Axios, providers e rota inicial**

`src/shared/api/client.ts`:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});
```

`src/app/router.tsx`:

```tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: function HomeRoute() {
    return <h1>Kurio</h1>;
  },
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

`src/app/providers.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/app/router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
    mutations: { retry: 0 },
  },
});

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

`src/main.tsx` renderiza `<AppProviders />` em strict mode e importa `./index.css`. Apague o CSS e o componente de exemplo do template (`App.tsx`, `App.css`, assets de exemplo) se não forem referenciados.

`index.html`: `<title>Kurio</title>` e lang `pt-BR`.

`.env.example`:

```
VITE_API_URL=/api
VITE_SOCKET_URL=wss://realtime.kurio.local
VITE_ENABLE_MOCKS=true
VITE_DEFAULT_SCENARIO=default
```

`.gitignore` deve incluir `node_modules`, `dist`, `.env`, `.superpowers`, `playwright-report`, `test-results`, `reports`.

`package.json` scripts, além dos do template:

```json
{
  "typecheck": "tsc -b --noEmit",
  "lint": "eslint ."
}
```

Se o template já tiver `build` chamando `tsc -b && vite build`, mantenha.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck
npm run build
```

Esperado: os dois comandos terminam com exit code 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js src .env.example .gitignore components.json
git commit -m "$(cat <<'EOF'
chore: prepara a base Vite do marketplace Kurio

A aplicação passa a compilar com Router, Query, Axios e Tailwind para as telas seguintes.

EOF
)"
```

Inclua também arquivos que o shadcn e o template tiverem criado e que façam parte da base (`src/lib/utils.ts`, `components.json`). Não versione `node_modules`, `dist` nem `.env`.

---

### Task 2: Tokens, fonte e casca

**Files:**
- Create: `src/app/shell.tsx`, `src/components/site-header.tsx`, `src/components/site-footer.tsx`
- Modify: `src/index.css`, `src/app/router.tsx`, `src/routes` root
- Test: `npm run typecheck` e `npm run build`

**Interfaces:**
- Consumes: `AppProviders` e `router` da Task 1
- Produces: `SiteHeader` e `SiteFooter`. O root route envolve o `Outlet` com header e footer. Links do header: Início `/`, Mercado `/`, e os rótulos Coleções e Artistas apontam para `/` com search `collection` vazio (não criam rota editorial). Busca do header escreve `q` na search da rota `/`. Ícone de carrinho aponta para `/cart` (a rota pode ser um placeholder `h1` até a Task 9). Entrar aponta para `/login` (placeholder até a Task 5).

- [ ] **Step 1: Ler o header no Figma**

`get_design_context` nos nodes `1:663` (header da home) e no footer dentro de `1:661`. Baixe SVGs do logo para `src/assets`.

- [ ] **Step 2: Tokens e fonte**

Instale `@fontsource/roboto-mono` (pesos 400, 500, 700) e importe no `main.tsx`. Mapeie os tokens da seção Global Constraints em `@theme` no `src/index.css` (`--color-ink`, `--color-foreground`, `--color-primary`, e os demais nomes dessa lista). `body` usa fundo `ink`, texto `foreground`, `font-family` Roboto Mono.

- [ ] **Step 3: Implementar header e footer**

Traduza o layout do Figma para Tailwind com os tokens. Não copie o posicionamento absoluto gerado pelo MCP. Largura útil 1200 no desktop, padding horizontal 20 no mobile. Header com busca, carrinho e entrar. Footer com as colunas visíveis no frame, links auxiliares para `#diario`.

- [ ] **Step 4: Verificar e commitar**

`npm run typecheck` e `npm run build` com exit 0.

```bash
git commit -m "$(cat <<'EOF'
feat: aplica a casca visual da Kurio

Header e footer passam a seguir os tokens e a composição do Figma.

EOF
)"
```

---

### Task 3: Contratos, dinheiro e erros

**Files:**
- Create: `src/shared/domain/money.ts`, `src/shared/domain/money.test.ts`, `src/shared/domain/contracts.ts`, `src/shared/api/errors.ts`
- Modify: `src/shared/api/client.ts`, `package.json`
- Test: `src/shared/domain/money.test.ts`

**Interfaces:**
- Consumes: `api` da Task 1
- Produces:
  - `addEth(a: string, b: string): string`
  - `subEth(a: string, b: string): string`
  - `mulEth(amount: string, quantity: number): string`
  - `cmpEth(a: string, b: string): -1 | 0 | 1`
  - `formatEth(amount: string): string` devolve `"1.19 ETH"` com até 4 casas, sem float de `number`.
  - Zod: `nftSummarySchema`, `nftDetailSchema`, `cartSchema`, `quoteSchema`, `orderSchema`, `userSchema`, `apiErrorSchema`.
  - `readApiError(error: unknown): { code: string; message: string; fields?: Record<string, string> }`.
  - Interceptor do Axios: se existir `kurio.session` no `localStorage`, envia `Authorization: Bearer <token>`.

Instale `decimal.js`, `zod` e `vitest`. Script `"test": "vitest run"`.

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { addEth, formatEth, mulEth } from "./money";

describe("money", () => {
  it("soma strings decimais sem perder precisão", () => {
    expect(addEth("0.10", "0.20")).toBe("0.30");
    expect(mulEth("1.19", 3)).toBe("3.57");
    expect(formatEth("1.1900")).toBe("1.19 ETH");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

`npx vitest run src/shared/domain/money.test.ts`. Esperado: falha porque o módulo não existe.

- [ ] **Step 3: Implementar com decimal.js**

Nenhuma operação usa `parseFloat` nem `Number` para calcular ETH. `formatEth` usa `toFixed` do decimal.js e remove zeros à direita.

Schemas Zod cobrem os campos mínimos: NFT (`id`, `slug`, `title`, `collection`, `network`, `priceEth`, `compareAtEth`, `available`, `imageUrl`), carrinho (`items`, `couponCode`), cotação (`subtotalEth`, `discountEth`, `networkFeeEth`, `totalEth`, `version`), pedido (`id`, `status`, `snapshot`, `txRef`), usuário (`id`, `name`, `email`). `status` do pedido: `pending` | `confirmed` | `declined`.

- [ ] **Step 4: Teste passa, typecheck passa, commit**

```bash
git commit -m "$(cat <<'EOF'
feat: fixa contratos e aritmética decimal de ETH

Preço e total deixam de depender de ponto flutuante.

EOF
)"
```

---

### Task 4: MSW, fixtures e cenários

**Files:**
- Create: `src/mocks/browser.ts`, `src/mocks/db.ts`, `src/mocks/seed.ts`, `src/mocks/scenarios.ts`, `src/mocks/handlers/health.ts`, `src/mocks/README.md`
- Modify: `src/main.tsx`, `package.json`
- Test: `src/mocks/db.test.ts`

**Interfaces:**
- Consumes: schemas da Task 3
- Produces:
  - `createSeed(): Database` com 36 NFTs (os 8 títulos visíveis na home mais variantes), 2 usuários, carrinhos vazios, sem pedidos. Marina tem 1 favorito (`emerald-ape-042`) e duas carteiras. Rafael não tem carteira nem favorito.
  - `resetDatabase(): void` volta ao seed do cenário atual.
  - `getScenario(): ScenarioId`
  - Handler `GET /api/health` responde `{ ok: true }`.
  - `enableMocks(): Promise<void>` inicia o worker só se `VITE_ENABLE_MOCKS !== "false"`.
  - `window.__kurio` expõe `reset`, `setScenario` e `emit` para os testes futuros.

Senhas no seed são o hex de SHA-256 da senha, calculado uma vez e colado no fixture (não a senha em texto). Marina: hash de `Marina#2026`. Rafael: hash de `Rafael#2026`.

NFTs nomeados no frame, com estes preços: Emerald Ape #042 `1.19`, Sage Nomad #009 `1.69`, Neon Vessel #552 `1.99` e `compareAtEth` `2.29`, Cosmic Bloom #118 `1.29`, Violet Nomad #314 `1.39`, Ivory Baron #088 `1.79`, Golden Beat #207 `0.99`, Golden Signal #160 `0.39`. Slug em kebab-case. Pelo menos 9 itens em `digital-art` e itens nas outras coleções para o filtro combinado não voltar vazio. Quatro páginas de 9.

- [ ] **Step 1: Teste do seed**

O teste importa `createSeed`, confere 36 NFTs, a presença de `emerald-ape-042` a `1.19`, e que o campo de senha dos usuários não contém `Marina#2026` nem `Rafael#2026`.

- [ ] **Step 2: Implementar persistência**

`localStorage` `kurio.mock`. `?reset=1` limpa a chave e regrava o seed antes do worker responder. `?scenario=` grava o cenário. `slow-network` atrasa 1200 ms. `offline` responde com `HttpResponse.error()`. `server-error` responde 503 nas duas primeiras leituras de `/api/nfts` e `/api/nfts/:id`. Os outros cenários ficam registrados na tabela e passam a alterar comportamento nas tasks que criam aqueles handlers. Documente a tabela em `src/mocks/README.md`.

Instale `msw` e rode `npx msw init public --save`.

`src/main.tsx` espera `enableMocks()` antes de `createRoot`.

- [ ] **Step 3: vitest, typecheck, commit**

```bash
git commit -m "$(cat <<'EOF'
feat: liga o backend simulado com seed reproduzível

O catálogo e os usuários passam a existir na camada de rede, com reset.

EOF
)"
```

---

### Task 5: Sessão, login e cadastro

**Files:**
- Create: `src/mocks/handlers/auth.ts`, `src/features/auth/session.ts`, `src/features/auth/login-page.tsx`, `src/features/auth/register-page.tsx`
- Modify: `src/mocks/browser.ts`, `src/app/router.tsx`
- Test: `src/features/auth/session.test.ts`

**Interfaces:**
- Consumes: `api`, `readApiError`, db da Task 4
- Produces:
  - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout`
  - `useSession()` via TanStack Query, query key `["session"]`
  - Rotas `/login` e `/register`
  - `requireAuth` beforeLoad nas rotas privadas (ainda só o placeholder `/cart` e, quando existirem, checkout, perfil, carteiras, pedidos). Guarda `redirect` na search para voltar ao fluxo anterior.

Login inválido: 401 `unauthorized`. E-mail repetido no cadastro: 409 `conflict`. Validação de campo vazio ou senha com menos de 8 caracteres: 422 `validation` com `fields`. Token opaco aleatório, guardado em `kurio.session`. Cenário `session-expired` faz `GET /api/auth/session` responder 401.

Telas: `get_design_context` em `1:1248`, `1:1282`, `1:1907`, `1:1927`. Mensagens de erro ligadas ao campo com `aria-describedby`.

- [ ] **Step 1: Teste da guarda de token**

O teste cobre: sem token, `GET` não envia Authorization (mock do adapter ou função pura `readSessionToken()` que lê `localStorage`). Com token `abc`, `readSessionToken()` devolve `abc`. Logout remove a chave.

- [ ] **Step 2: Handlers e telas**

Implemente os handlers e as duas telas a partir do Figma. Sucesso no login invalida `["session"]` e navega para `redirect` ou `/`.

- [ ] **Step 3: vitest, typecheck, commit**

```bash
git commit -m "$(cat <<'EOF'
feat: autentica o colecionador contra a sessão simulada

Login e cadastro validam na API e devolvem o usuário ao fluxo anterior.

EOF
)"
```

---

### Task 6: Catálogo

**Files:**
- Create: `src/mocks/handlers/nfts.ts`, `src/features/catalog/home-page.tsx`, `src/features/catalog/filters.tsx`, `src/features/catalog/nft-card.tsx`, `src/features/catalog/search.ts`
- Modify: `src/app/router.tsx`, `src/mocks/browser.ts`
- Test: `src/features/catalog/search.test.ts`

**Interfaces:**
- Consumes: `nftSummarySchema`, seed, `SiteHeader`
- Produces:
  - `GET /api/nfts` com `q`, `collection` (repetível), `network` (repetível), `minPrice`, `maxPrice`, `sort`, `tab`, `page`, `pageSize`
  - Resposta `{ items, page, pageSize, total, facets }` onde `facets` traz a contagem por coleção e rede depois dos outros filtros
  - `catalogSearchSchema` (Zod) faz o parse da search da rota `/`
  - Home substitui o `h1` solto e compõe hero, filtros, grade, paginação e diário a partir do node `1:661` e do mobile `1:1531`

`search.test.ts`: parse de `?collection=music&collection=games&page=3`; mudar coleção no helper `withFilter` zera `page` para 1.

Resposta fora de ordem: o `queryKey` inclui todos os parâmetros. Não aplique resultado de uma key antiga (o Query já isola; não guarde lista em `useState` paralelo). Vazio: texto de estado vazio no lugar da grade. Erro: alerta com botão para `refetch`. Loading: skeleton da grade com 9 cartões de 258×356 no desktop. `slow-network` deixa o skeleton visível.

Hero: kicker "Bem-vindo à Kurio", título "OWN THE FUTURE OF DIGITAL ART" quebrado como no frame, subtítulo do node `1:673`, botão "EXPLORAR" leva a `#catalogo`.

- [ ] **Step 1: Teste do helper de search**
- [ ] **Step 2: Handler e página**
- [ ] **Step 3: vitest, typecheck, commit** `feat: publica o catálogo com filtros na URL`

---

### Task 7: Detalhe do NFT

**Files:**
- Create: `src/features/nft/detail-page.tsx`, `src/mocks/handlers/nfts.ts` (rota de detalhe no mesmo arquivo)
- Modify: `src/app/router.tsx`
- Test: o handler de inexistente é coberto na Task 14; aqui, typecheck e build

**Interfaces:**
- Consumes: `GET /api/nfts`
- Produces: `GET /api/nfts/$slug` 200 ou 404 `not_found`. Rota `/nfts/$slug`. Edição indisponível desabilita compra. Quantidade inteira entre 1 e `available`.

Layout dos nodes `1:844` e `1:1629`: galeria, preço, seletor de edição, quantidade, favorito (botão presente; a mutation entra na Task 8) e comprar, que adiciona ao carrinho quando a Task 9 existir. Até lá, o botão chama `POST /api/cart/items` e a Task 9 implementa o handler. Se a Task 9 ainda não mergeou o handler, esta task cria o POST mínimo `{ slug, editionId, quantity }` que a Task 9 vai completar, sem duplicar a regra.

Estado 404 com o mesmo fundo da aplicação e um link de volta para `/`.

- [ ] **Step 1: Ler os frames e implementar**
- [ ] **Step 2: typecheck, build, commit** `feat: abre o detalhe do NFT por slug`

---

### Task 8: Favoritos

**Files:**
- Create: `src/features/favorites/use-favorite.ts`, `src/mocks/handlers/favorites.ts`
- Modify: detalhe e card
- Test: `src/features/favorites/use-favorite.test.ts` não é obrigatório se a mutation for só de hook; cubra a regra pura `toggleFavoriteList(ids: string[], slug: string): string[]`

**Interfaces:**
- Produces: `GET /api/favorites`, `PUT /api/favorites/:slug`, `DELETE /api/favorites/:slug`. Query key `["favorites", userId]`. `onMutate` atualiza a lista e `onError` restaura o snapshot. Visitante é enviado a `/login?redirect=`.

- [ ] **Step 1: Teste de `toggleFavoriteList`**
- [ ] **Step 2: Handler, hook otimista, botão no detalhe e no card**
- [ ] **Step 3: vitest, typecheck, commit** `feat: persiste favoritos com rollback otimista`

---

### Task 9: Carrinho

**Files:**
- Create: `src/features/cart/cart-page.tsx`, `src/mocks/handlers/cart.ts`
- Modify: router, detalhe
- Test: `src/features/cart/merge.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`
  - `mergeGuestCart(guestItems, userItems)` soma quantidades do mesmo `editionId` e respeita `available`
  - Carrinho de visitante em `kurio.guest-cart`. No login, o cliente envia esses itens uma vez e apaga a chave.
  - Página nos nodes `1:994` e `1:1694`

Quantidade acima do disponível: 409 `conflict`. Remoção tira a linha. Refresh relê `GET /api/cart`.

- [ ] **Step 1: Teste do merge**
- [ ] **Step 2: Handlers e página**
- [ ] **Step 3: vitest, typecheck, commit** `feat: mantém o carrinho entre visita e login`

---

### Task 10: Cotação e cupom

**Files:**
- Create: `src/features/cart/quote.ts`, `src/mocks/handlers/quote.ts`
- Modify: `cart-page.tsx`, `cart.ts` handler se o cupom ficar no carrinho
- Test: `src/features/cart/quote.test.ts` apenas se houver função pura; a regra de cupom mora no handler. Teste a função `applyCoupon(code: string): { ok: true; rate: string } | { ok: false; reason: "invalid" | "expired" }` com `GENESIS10` → rate `0.10`, `DROP5` → `0.05`, `VENCIDO` → expired, `XYZ` → invalid.

**Interfaces:**
- Produces: `POST /api/quote` corpo `{ items, couponCode }` resposta `quoteSchema`. Taxa de rede fixa do seed `0.02` ETH. Desconto sobre o subtotal. Total = subtotal − desconto + taxa, via `addEth`/`subEth`/`mulEth`. A página mostra subtotal, desconto, taxa e total vindos da resposta, não de conta local paralela.

- [ ] **Step 1: Teste de `applyCoupon`**
- [ ] **Step 2: Handler e resumo na página**
- [ ] **Step 3: vitest, typecheck, commit** `feat: calcula a cotação do carrinho na API`

---

### Task 11: Checkout, carteiras e pedido

**Files:**
- Create: `src/features/checkout/payment-page.tsx`, `src/features/orders/confirmation-page.tsx`, `src/mocks/handlers/orders.ts`, `src/mocks/handlers/wallets.ts`, `src/features/wallets/types.ts`
- Modify: router
- Test: `src/features/orders/idempotency.test.ts`

**Interfaces:**
- Produces:
  - `GET/POST /api/wallets`, `PATCH /api/wallets/:id`
  - `POST /api/orders` exige header `Idempotency-Key`
  - `GET /api/orders/:id`
  - `placeOrderKey(body: string): string` não é a chave; a UI gera um UUID por tentativa e reutiliza esse UUID no retry depois de timeout
  - Função pura `sameOrderAttempt(storedBody: string, nextBody: string): boolean`
  - Rotas `/checkout` e `/orders/$orderId`, ambas com `requireAuth`
  - Telas `1:1150`, `1:1785`, `1:1153`

Carteira: simulação de conectar, recusar (`wallet-connect-rejected`) e desconectar, sem extensão. Redes ethereum, polygon, solana.

Antes de confirmar, a página pede uma cotação nova. Se `version` mudou em relação à revisão mostrada, bloqueia o envio até o usuário confirmar de novo.

`order-timeout`: a primeira `POST /api/orders` espera 8s e devolve erro de rede, mas grava o pedido `pending`. O retry com a mesma chave devolve esse pedido. `payment-declined` grava `declined`. `payment-confirmed` e `default` gravam `confirmed`. Confirmação só renderiza recibo quando `status === "confirmed"`. Recusado mostra o estado recusado, sem recibo de sucesso. Itens comprados saem do carrinho só depois de `confirmed`, na quantidade comprada. Falha não esvazia o carrinho.

O recibo usa `snapshot` gravado no pedido (preços, taxa, cupom, itens), não o catálogo ao vivo.

Clique repetido: o botão desabilita enquanto a mutation está `pending` e a chave não muda.

- [ ] **Step 1: Teste `sameOrderAttempt`**
- [ ] **Step 2: Handlers, pagamento e confirmação a partir do Figma**
- [ ] **Step 3: vitest, typecheck, commit** `feat: confirma o pedido com chave de idempotência`

---

### Task 12: Socket.IO

**Files:**
- Create: `src/features/realtime/socket.ts`, `src/mocks/socket.ts`
- Modify: catálogo, detalhe, carrinho, confirmação, `window.__kurio.emit`
- Test: `src/features/realtime/version.test.ts`

**Interfaces:**
- Produces:
  - `shouldApplyVersion(current: number | undefined, incoming: number): boolean` é falso quando `incoming <= current`
  - Cliente conecta em `VITE_SOCKET_URL` com `auth: { token }`
  - Eventos `nft.updated` e `order.updated` com `{ eventId, version, resource }`
  - Mock via `@mswjs/socket.io-binding`. Documente em `src/mocks/README.md` a limitação: o transporte é interceptado pelo MSW no browser; não há servidor Socket.IO externo.
  - `price-changed` e o botão do painel emitem `nft.updated` do primeiro item do carrinho (+10% no preço, version + 1). A UI mostra que o preço mudou e atualiza o resumo. Checkout com cotação de version antiga não confirma.
  - Desconectar no meio de `pending` e recarregar chama `GET /api/orders/:id` sem criar outro pedido.

Listeners são removidos no cleanup do efeito. Troca de usuário descarta o socket anterior.

- [ ] **Step 1: Teste de versão**
- [ ] **Step 2: Binding, cliente e painel de cenários**
- [ ] **Step 3: vitest, typecheck, commit** `feat: sincroniza preço e pedido pelo Socket.IO`

---

### Task 13: Perfil e carteiras

**Files:**
- Create: `src/features/profile/profile-page.tsx`, `src/features/wallets/wallets-page.tsx`, `src/mocks/handlers/profile.ts`
- Modify: router, handlers de wallets
- Test: typecheck e build; validação de formulário coberta na Task 14

**Interfaces:**
- Produces: `GET/PATCH /api/profile`, `POST /api/profile/password`, `POST /api/profile/avatar` (data URL ou arquivo pequeno simulado, persistido no db). Senha atual errada: 422 `validation`. Avatar e nome permanecem após refresh. Telas `1:1316` e `1:1414`, empilhadas abaixo de 768 px.

- [ ] **Step 1: Ler os frames e implementar os formulários com labels e `aria-invalid`**
- [ ] **Step 2: typecheck, build, commit** `feat: edita perfil, senha e carteiras`

---

### Task 14: Playwright

**Files:**
- Create: `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/specs/*.spec.ts`
- Modify: `package.json`
- Test: os próprios specs

**Interfaces:**
- Consumes: `window.__kurio`, `?scenario=`, `?reset=1`
- Produces: `npm run test:e2e` executa Chromium nos viewports 1440 e 390. `npm run test:e2e:report` abre o HTML. Trace em falha. Cada teste chama reset antes de agir.

Cubra, um arquivo por fluxo, os 12 grupos do enunciado (seção 9), incluindo regressão visual de início, detalhe, carrinho e pagamento com `toHaveScreenshot` e dados do seed. Relógio e latência controlados por cenário, não por `waitForTimeout` solto. Tempo real passa pelo cliente socket: o teste chama `window.__kurio.emit`. REST passa pelos handlers (o teste não faz `setQueryData`).

- [ ] **Step 1: Configurar Playwright com `webServer` `npm run dev`**
- [ ] **Step 2: Escrever os specs**
- [ ] **Step 3: `npm run test:e2e` exit 0 e commit** `test: cobre os fluxos do desafio no Playwright`

---

### Task 15: Lighthouse, README e ARCHITECTURE

**Files:**
- Create: `README.md`, `ARCHITECTURE.md`, `lighthouse/lighthouserc.json` ou script `scripts/lighthouse.mjs`, `docs/lighthouse/REPORT.md`
- Modify: `package.json`, `vercel.json`
- Test: `npm run lighthouse` gera os relatórios; não falhe o script se uma mediana ficar abaixo da meta, mas registre a mediana e a causa no REPORT

**Interfaces:**
- Produces: comandos `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:e2e`, `lighthouse`. `vercel.json` com fallback SPA. README com setup, variáveis, credenciais, cenários, reset e como reproduzir cada falha. ARCHITECTURE com contratos, sessão, carrinho, cache, reconciliação REST/socket, limitações do binding MSW e desvios do Figma.

Metas do enunciado: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90, em `/` e num detalhe, mobile e desktop, três medições, mediana. Build de produção com os mocks ligados. Sem atalho que remova imagem ou fonte só para subir a nota.

- [ ] **Step 1: Documentar**
- [ ] **Step 2: Rodar a auditoria e preencher REPORT com mediana, LCP, CLS e TBT**
- [ ] **Step 3: Commit** `docs: registra execução, contratos e auditoria Lighthouse`
