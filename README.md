# Kurio — marketplace de NFTs

Entrega do Desafio Frontend: marketplace de NFTs em React + TypeScript, com catálogo (busca, filtros, ordenação e paginação na URL), detalhe, favoritos, carrinho, cotação com cupom, checkout com carteira, confirmação de pedido, login/cadastro, perfil e carteiras — desktop e mobile.

Não há backend externo. REST (`/api`) e Socket.IO (`nft.updated`, `order.updated`) são simulados no navegador com **MSW**, com estado em `localStorage`. O build de demonstração sobe com os mocks ligados.

| Stack (obrigatória) | Uso |
| --- | --- |
| React + TypeScript | UI tipada |
| TanStack Router | Rotas, search params e rotas privadas |
| TanStack Query | Queries, mutations, cache e invalidação |
| Axios | Cliente HTTP |
| Socket.IO client | Tempo real (`socket.io-client`) |
| Tailwind CSS + shadcn/ui | Estilo e componentes |
| MSW (+ `@mswjs/socket.io-binding`) | Mocks REST e Socket.IO |
| Playwright | E2E e regressão visual |
| Lighthouse | Auditoria de performance/qualidade |

Ferramenta de build: **Vite 8**. Detalhes de arquitetura, contratos, sessão, carrinho, cache e reconciliação REST/Socket.IO: [ARCHITECTURE.md](./ARCHITECTURE.md). Comportamento dos mocks: [src/mocks/README.md](./src/mocks/README.md). Layout de referência (enunciado): [Figma Frontend-Challenge](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1). Arte e composição desta entrega seguem também o arquivo [Desafio NFT](https://www.figma.com/design/29GDGWiDm9YFc1IsHGrFby/Desafio-NFT?node-id=0-1) usado no desenvolvimento.

## Entrega para avaliação

| Item | Valor |
| --- | --- |
| Repositório | https://github.com/abnerndr/nft-marketplace-desafio |
| URL pública | https://nft-marketplace-desafio-seven.vercel.app/ |
| Credenciais de demo | `marina@kurio.test` / `Marina#2026` ; `rafael@kurio.test` / `Rafael#2026` |
| Node | **24** (LTS) |
| Lockfile | `package-lock.json` (use `npm ci`) |

A versão publicada deve corresponder a este repositório, com mocks e tempo real ativos. Deep link e refresh de rotas usam o fallback SPA em `vercel.json` (ex.: `/nfts/emerald-ape-042`).

## Setup

```bash
git clone https://github.com/abnerndr/nft-marketplace-desafio.git
cd nft-marketplace-desafio
cp .env.example .env   # opcional; os padrões já bastam para a demo
npm ci
npm run dev            # http://localhost:5173
```

Na primeira visita o app grava o seed em `localStorage` (chave `kurio.mock`). Para voltar ao cenário conhecido: `http://localhost:5173/?reset=1`.

Pré-requisitos dos E2E (só na primeira vez):

```bash
npx playwright install chromium
```

## Variáveis de ambiente

Todas são `VITE_*` (embutidas no build). Modelo em [.env.example](./.env.example).

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Base do Axios |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.local` | Host do Socket.IO; com mocks, o MSW intercepta |
| `VITE_ENABLE_MOCKS` | `true` | `false` desliga o worker (app fala com API/socket reais) |
| `VITE_DEFAULT_SCENARIO` | `default` | Cenário inicial do mock; id desconhecido vira `default` |

Para a demonstração e a avaliação, mantenha `VITE_ENABLE_MOCKS=true`.

## Credenciais fictícias

Credenciais de demo: `marina@kurio.test` / `Marina#2026` ; `rafael@kurio.test` / `Rafael#2026`

| Usuário | E-mail | Senha | Estado inicial |
| --- | --- | --- | --- |
| Marina Alves | `marina@kurio.test` | `Marina#2026` | 1 favorito (`emerald-ape-042`) e duas carteiras |
| Rafael Costa | `rafael@kurio.test` | `Rafael#2026` | Sem favorito e sem carteira conectada |

Também é possível criar conta em `/register`. Senhas no mock são só hash SHA-256 (nunca texto claro).

Cupons de demo: `GENESIS10` (10%), `DROP5` (5%), `VENCIDO` (expirado → 422).

## Seleção e reset de cenários

| Como | Efeito |
| --- | --- |
| `?reset=1` | Apaga `kurio.mock` e regrava o seed. Ex.: `/?reset=1` |
| `?scenario=<id>` | Grava o cenário e volta ao seed dele. Ex.: `/?scenario=slow-network` |
| `window.__kurio` | Console: `reset()`, `setScenario(id)`, `switchScenario(id)`, `emit(type, payload?)`, `disconnectSocket()`, `reconnectSocket()` |
| Botão **Cenários** | Mobile: canto inferior esquerdo; desktop: inferior direito. Inclui **Mudar preço do 1º item (+10%)** (`nft.updated` via Socket.IO) |

`setScenario` troca o cenário **e** reseta o seed. `switchScenario` só troca o cenário (útil para falhas no meio do fluxo).

O reset regrava `kurio.mock`. Tokens antigos em `kurio.session` deixam de valer (próxima leitura → 401). O carrinho de visitante (`kurio.guest-cart`) permanece. Para zerar tudo, limpe o `localStorage`. Com `?reset=1` na URL, cada recarga zera de novo — remova o parâmetro para continuar.

Cenários aceitos: `default`, `empty`, `slow-network`, `out-of-order`, `offline`, `server-error`, `session-expired`, `validation-conflict`, `coupon-invalid`, `forbidden`, `stock-changed`, `socket-disconnect`, `price-changed`, `edition-sold-out`, `order-timeout`, `payment-confirmed`, `payment-declined`. Detalhes em [src/mocks/README.md](./src/mocks/README.md).

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks (`http://localhost:5173`) |
| `npm run build` | `tsc -b` + build de produção em `dist/` (mocks ligados na demo) |
| `npm run preview` | Serve `dist/` em `http://localhost:4173` |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unidade + handlers do mock) em `src/` |
| `npm run test:e2e` | Playwright (Chromium, desktop 1440 e mobile 390); sobe o Vite sozinho |
| `npm run test:e2e:report` | Abre o relatório HTML do Playwright |
| `npm run lighthouse` | Build, preview e auditoria Lighthouse (medianas em [docs/lighthouse/REPORT.md](./docs/lighthouse/REPORT.md)) |

## Como reproduzir fluxos de falha

Parta de um estado limpo: `http://localhost:5173/?reset=1&scenario=<id>`.

| Falha | Cenário | Passos |
| --- | --- | --- |
| Rede lenta (skeletons) | `slow-network` | Abra `/`. Cada `/api/*` espera ~1,2 s |
| Sem conexão | `offline` | Abra `/`. Falha de rede; use **Tentar novamente** |
| Erro 503 transitório | `server-error` | Lista/detalhe: as 2 primeiras leituras falham com 503; retry recupera |
| Catálogo vazio | `empty` | Abra `/`: lista vazia e facetas zeradas |
| Respostas fora de ordem | `out-of-order` | Em `/`, digite na busca ou troque filtros rápido; a UI mantém só a resposta mais recente |
| Sessão expirada | `session-expired` | Entre e abra `/checkout` ou `/account/profile`; redireciona ao login com `?redirect=` |
| Cupom inválido/expirado | qualquer | No carrinho: `VENCIDO` ou código inexistente → 422 |
| Preço mudou no carrinho/checkout | `price-changed` | Entre, adicione item, abra `/cart`; em ~1,5 s chega `nft.updated` (+10%). No checkout a cotação revista muda a `version` |
| Edição esgotada | `edition-sold-out` | Checkout completo → 409 `edition_sold_out` |
| Pagamento recusado | `payment-declined` | Checkout → pedido `declined` |
| Timeout + idempotência | `order-timeout` | Checkout: 1ª `POST /orders` grava `pending` e falha na rede; retry com a mesma `Idempotency-Key` recupera o pedido |
| Pagamento confirmado | `payment-confirmed` ou `default` | Checkout → `confirmed` com `txRef` |
| Queda do Socket.IO | `socket-disconnect` ou console | Com pedido pendente ou carrinho aberto: `window.__kurio.disconnectSocket()`; ao reconectar, o cliente reconcilia via REST |
| Conflito de cadastro/validação | `default` | Cadastre de novo `marina@kurio.test`; senha atual errada no perfil; carteira desconectada no pagamento |

## Documentação de arquitetura (obrigatória)

O enunciado pede estes tópicos documentados — todos estão em [ARCHITECTURE.md](./ARCHITECTURE.md):

- **Contratos REST e eventos** — schemas Zod, endpoints, códigos de erro, `nft.updated` / `order.updated`
- **Política de sessão** — token, 401, redirect seguro, isolamento de cache privado
- **Estado do carrinho** — visitante vs logado, merge no login, cotação
- **Estratégia de cache** — chaves React Query, retries, cancelamento, favoritos otimistas, idempotência de pedidos
- **Reconciliação REST × Socket.IO** — REST como fonte da verdade; filtros de `userId` / `eventId` / `version`; invalidação na reconexão
- **Limitações, UX e desvios do Figma** — seção dedicada no mesmo arquivo

## Testes

- `npm test`: regras puras (dinheiro, merge de carrinho, idempotência, versão de evento) e handlers MSW.
- `npm run test:e2e`: specs de catálogo, detalhe, auth, favoritos, carrinho, compra, falha de pagamento, perfil/carteiras, preço via socket, pedido pendente, teclado/foco, loading/falha e regressão visual.
- Baselines visuais (`e2e/specs/13-visual.spec.ts-snapshots`) foram geradas em **Linux**. Em macOS/Windows o spec visual pode falhar por renderização de fonte, sem ser regressão de produto. O CI roda em Ubuntu.

## Deploy

Demo publicada na Vercel: **https://nft-marketplace-desafio-seven.vercel.app/**

`vercel.json` define `buildCommand`, `outputDirectory: dist` e rewrite SPA (`/(.*) → /index.html`) para deep links e refresh.

```bash
npm run build
npm run preview   # smoke local do artefato publicado
# Redeploy: push em master (integração Vercel) ou `vercel --prod`
```

Confirme após cada publicação que a URL acima responde, que `/?reset=1` reseedar o mock e que um deep link (`/nfts/emerald-ape-042`) não devolve 404 do host.

## Limitações conhecidas (resumo)

Detalhes em [ARCHITECTURE.md](./ARCHITECTURE.md#limitações-conhecidas):

- Binding Socket.IO via peer MSW 2 forçado a MSW 3 (`overrides` no `package.json`)
- Performance do detalhe em mobile (Lighthouse) abaixo da meta ≥ 90 — ver [docs/lighthouse/REPORT.md](./docs/lighthouse/REPORT.md)
- Baselines visuais versionadas só para Linux
- Alguns cenários são marcadores; o erro correspondente já sai das regras normais da API
