# Kurio — marketplace de NFTs

Front-end do desafio de marketplace de NFTs: catálogo com busca e filtros, detalhe com edições, favoritos,
carrinho (visitante e logado), cotação com cupom, checkout com carteira, confirmação de pedido, perfil e
carteiras. Não há servidor: a API REST e o Socket.IO são simulados no navegador com MSW, e o estado vive em
`localStorage`.

Stack: React 19, TypeScript, Vite 8, TanStack Router e Query, Axios, Zod, Tailwind 4 e componentes Radix/shadcn,
`socket.io-client`, MSW 3, Vitest e Playwright.

A arquitetura, os contratos e as decisões estão em [ARCHITECTURE.md](./ARCHITECTURE.md). O comportamento do
backend simulado está em [src/mocks/README.md](./src/mocks/README.md).

## Setup

Requer Node 24 e npm.

```bash
npm install
npm run dev        # http://localhost:5173
```

Na primeira visita o app grava o seed no `localStorage` (chave `kurio.mock`).

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento do Vite, com mocks. |
| `npm run build` | `tsc -b` e build de produção em `dist/`. Os mocks continuam ligados (build de demonstração). |
| `npm run preview` | Serve `dist/` em `http://localhost:4173`. |
| `npm run typecheck` | `tsc -b --noEmit`. |
| `npm run lint` | ESLint. |
| `npm test` | Vitest (unidade e handlers do mock), só em `src/`. |
| `npm run test:e2e` | Playwright em dois viewports (desktop 1440 e mobile 390). Sobe o `npm run dev` sozinho. |
| `npm run test:e2e:report` | Abre o relatório HTML do Playwright. |
| `npm run lighthouse` | Build, preview e auditoria Lighthouse. Veja [docs/lighthouse/REPORT.md](./docs/lighthouse/REPORT.md). |

Na primeira execução do Playwright instale o navegador: `npx playwright install chromium`.

## Variáveis de ambiente

Veja `.env.example`. Todas são lidas no build (`VITE_*`).

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Base do cliente Axios. |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.local` | Host do Socket.IO. Com mocks, o MSW intercepta esse host. |
| `VITE_ENABLE_MOCKS` | `true` | Com `false` o worker do MSW não sobe e o app fala com `VITE_API_URL` e `VITE_SOCKET_URL` de verdade. |
| `VITE_DEFAULT_SCENARIO` | `default` | Cenário inicial do mock. Valor desconhecido vira `default`. |

## Credenciais

| Usuário | E-mail | Senha | Estado inicial |
| --- | --- | --- | --- |
| Marina Alves | `marina@kurio.test` | `Marina#2026` | 1 favorito (`emerald-ape-042`) e duas carteiras. |
| Rafael Costa | `rafael@kurio.test` | `Rafael#2026` | Sem favorito e sem carteira conectada. |

Também dá para criar uma conta em `/register`. Cupons: `GENESIS10` (10%), `DROP5` (5%) e `VENCIDO` (expirado,
responde 422).

## Reset e cenários

| Como | Efeito |
| --- | --- |
| `?reset=1` | Apaga `kurio.mock` e regrava o seed. Ex.: `http://localhost:5173/?reset=1`. |
| `?scenario=<id>` | Grava o cenário e volta ao seed dele. Ex.: `/?scenario=slow-network`. Id desconhecido é ignorado. |
| `window.__kurio` | No console: `reset()`, `setScenario(id)` e `emit(type, payload)`. |
| Botão **Cenários** (canto inferior direito) | Abre o painel; **Mudar preço do 1º item (+10%)** dispara `nft.updated` pelo Socket.IO mock. |

O reset regrava só `kurio.mock`. As sessões moram nesse banco, então o token antigo em `kurio.session` deixa
de valer e a próxima leitura da sessão devolve 401 (o app o descarta). O carrinho de visitante
(`kurio.guest-cart`) fica. Para zerar tudo, limpe o `localStorage`. Com `?reset=1` na URL, cada recarga zera de
novo; tire o parâmetro para continuar de onde parou.

## Como reproduzir cada falha

Todas partem de `?reset=1&scenario=<id>`, por exemplo `http://localhost:5173/?reset=1&scenario=offline`.

| Falha | Cenário | Passos |
| --- | --- | --- |
| Rede lenta (esqueletos, estado de carregamento) | `slow-network` | Abra `/`. Cada chamada `/api/*` espera 1,2 s. |
| Sem conexão | `offline` | Abra `/`. Toda chamada `/api/*` falha na rede; a tela mostra erro com **Tentar novamente**. |
| Erro 503 transitório | `server-error` | Abra `/` ou um detalhe. As duas primeiras leituras falham com 503; **Tentar novamente** recupera. Lista e detalhe têm contadores separados. |
| Catálogo vazio | `empty` | Abra `/`: lista vazia e facetas zeradas. |
| Respostas fora de ordem | `out-of-order` | Em `/`, digite na busca ou troque filtros em sequência. Cada busca espera menos que a anterior (900, 400, 50 ms); a tela mantém só a resposta da busca mais recente. |
| Sessão expirada | `session-expired` | Entre, depois abra `/checkout` ou `/account/profile`. A sessão deixa de valer: o app volta ao login e guarda o destino em `?redirect=`. |
| Cupom inválido ou expirado | qualquer | No carrinho, aplique `VENCIDO` (expirado) ou qualquer outro código (inválido). Resposta 422 e nenhum desconto. |
| Preço mudou antes de pagar | `price-changed` | Entre, adicione um item e abra `/cart`. Em 1,5 s chega `nft.updated` (+10%) com aviso de preço. No checkout, a cotação revista vem com taxa de 0,03 ETH e outra `version`. O mesmo evento sai do painel de cenários. Visitante também recebe `nft.updated` público. |
| Edição esgotou | `edition-sold-out` | Entre, adicione item, conecte carteira e confirme o pagamento. Resposta 409 `edition_sold_out`. |
| Pagamento recusado | `payment-declined` | Mesmo fluxo; o pedido fica `declined` na tela de confirmação. |
| Pedido pendente e timeout | `order-timeout` | Mesmo fluxo. O pedido é gravado como `pending`, a resposta se perde após 8 s e o retry reaproveita a `Idempotency-Key`. Na segunda leitura do pedido ele confirma e `order.updated` chega pelo socket. |
| Pagamento confirmado | `payment-confirmed` ou `default` | Mesmo fluxo; pedido `confirmed` com `txRef`. |
| Conflito de validação | `validation-conflict` | Id aceito, mas sem comportamento próprio. Erros por campo (`fields`) saem de e-mail repetido no cadastro, carteira desconectada e senha atual errada. |

## Testes

- `npm test`: regras puras (dinheiro, merge de carrinho, idempotência, versão de evento) e handlers do mock.
- `npm run test:e2e`: 13 specs de fluxo (catálogo, detalhe, auth, favoritos, carrinho, compra, falha de
  pagamento, perfil e carteiras, preço por socket, pedido pendente, teclado e foco, carregamento e falha,
  visual).
- Os baselines visuais (`e2e/specs/13-visual.spec.ts-snapshots`) existem só para Linux. Em macOS ou Windows o
  spec visual falha por diferença de renderização, não por regressão.

## Deploy

`vercel.json` só prepara o fallback de SPA (todo caminho cai em `/index.html`) e o diretório `dist`. Nenhum
deploy foi feito.

## Limitações conhecidas

Estão detalhadas em [ARCHITECTURE.md](./ARCHITECTURE.md#limitações-conhecidas). Em resumo: o binding de
Socket.IO usa um peer de MSW 2 sobre MSW 3; o mock não derruba o WebSocket; baselines visuais só em Linux; e
fundos e alguns campos do Figma foram adaptados (veja a seção em ARCHITECTURE.md).
