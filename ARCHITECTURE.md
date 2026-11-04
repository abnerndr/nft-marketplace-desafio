# Arquitetura

Single-page app em React 19 com TanStack Router (rotas) e TanStack Query (estado de servidor). Não existe
backend: o navegador roda um servidor simulado (MSW 3) que responde ao REST em `/api/*` e ao Socket.IO em
`wss://realtime.kurio.local`. O app só conhece contratos, nunca o mock.

```
src/
  app/         providers, router, shell (header, avisos, painel de cenários, footer)
  routes/      uma rota por tela, finas; a tela vive em features/
  features/    auth, catalog, nft, favorites, cart, checkout, orders, profile, wallets, realtime
  shared/      api (axios, erros, query client) e domain (contratos Zod, dinheiro)
  mocks/       db (localStorage), seed, cenários, handlers REST, socket
```

`src/main.tsx` dispara `import("@/mocks/browser")` em paralelo ao `createRoot`: a UI pinta na hora e o worker MSW
termina depois. Requests Axios e o Socket.IO esperam `waitForMocks()` para não falarem na rede real. Com
`VITE_ENABLE_MOCKS=false` o worker não sobe e `markMocksReady()` libera as requests imediatamente. Telas de
checkout, carrinho, conta, pedidos e auth entram via `React.lazy`.

## Contratos

Todo contrato está em `src/shared/domain/contracts.ts` como schema Zod, e os tipos saem de `z.infer`. Toda
resposta é validada com `schema.parse` na borda do cliente (`api.get(...)` seguido de `parse`), então um
servidor que se desvie do contrato quebra alto e cedo, não na renderização.

| Contrato | Forma |
| --- | --- |
| `NftSummary` / `NftDetail` | `slug`, `title`, `priceEth` (string), `priceVersion?`, `available`; o detalhe soma `editions[]`, `rating` e textos. |
| `CartView` | `items[]` (`slug`, `editionId`, `quantity`, `available`, `priceEth`, `priceVersion?`...) e `couponCode`. |
| `Quote` | `subtotalEth`, `discountEth`, `networkFeeEth`, `totalEth`, `version`. |
| `Order` | `id`, `status` (`pending`, `confirmed`, `declined`), `snapshot`, `txRef`, `wallet`, `createdAt`. |
| `ApiError` | `{ error: { code, message, fields? } }`. `fields` mapeia campo para mensagem. |

Regras que valem para o cliente e para o mock:

- **Dinheiro é string decimal** (`"1.19"`), nunca `number`. A conta passa por `decimal.js` em
  `shared/domain/money.ts` (`addEth`, `subEth`, `mulEth`, `mulEthRate`, `formatEth`). Quantidades
  são inteiras (`mulEth`); taxas/percentuais usam `mulEthRate` sem arredondar à escala da entrada.
  Transporte limita-se a 18 casas decimais (valores além disso são rejeitados). `formatEth`
  apresenta a escala completa, sem notação exponencial. Evita `0.1 + 0.2` e `Number` em ETH.
- **O preço vem do servidor.** O cliente manda `slug`, `editionId` e `quantity`; subtotal, desconto, taxa e total
  são calculados no servidor (`POST /api/quote`).
- **Erros** passam por `readApiError` (`shared/api/errors.ts`): lê `error.response.data.error` com o schema
  `ApiError` e, sem corpo válido (rede, por exemplo), cai em `{ code: "unknown", message }`. Telas mostram
  `message` e pintam o campo de `fields`.

### Endpoints

| Método e caminho | Uso |
| --- | --- |
| `POST /auth/register`, `POST /auth/login` | Devolvem `{ user, token }`. |
| `GET /auth/session`, `POST /auth/logout` | Sessão atual e saída. |
| `GET /nfts`, `GET /nfts/:slug` | Catálogo (busca, filtros, página) e detalhe. |
| `GET/PUT/DELETE /favorites[/:slug]` | Favoritos do usuário. |
| `GET /cart`, `POST /cart/items`, `PATCH`/`DELETE /cart/items/:id`, `PUT /cart/coupon` | Carrinho do usuário. |
| `POST /quote` | Cotação para visitante e logado; 422 `coupon_invalid` ou `coupon_expired`. |
| `POST /orders`, `GET /orders/:id` | Pedido. `Idempotency-Key` obrigatório no `POST`. |
| `GET/POST /wallets`, `PATCH /wallets/:id` | Carteiras. `PATCH` aceita `action` (`connect`, `reject`, `disconnect`, `set-primary`) ou edição de `label`, `address` e `network`. |
| `GET/PATCH /profile`, `POST /profile/password`, `POST /profile/avatar` | Perfil. |

Códigos de erro que a UI trata: `unauthorized` (401), `not_found` (404), `quote_changed`, `cart_changed`,
`edition_sold_out`, `idempotency_conflict` (409), `wallet_not_connected`, `cart_empty`, `coupon_invalid`,
`coupon_expired` (422) e `idempotency_key_required` (400).

## Sessão

- O token é opaco e fica em `localStorage` (`kurio.session`). O interceptor do Axios (`shared/api/client.ts`) o
  envia como `Authorization: Bearer`.
- `useSession()` é uma query (`["session"]`, `staleTime` 30 s). Sem token ela resolve `null` sem chamar a rede.
  Um 401 apaga o token e resolve `null`; qualquer outro erro sobe.
- **401 no meio do fluxo.** Qualquer `401` de uma requisição que levou token (pedido, checkout, carrinho,
  sessão) dispara `handleSessionExpired`: apaga só o token, marca a sessão como `null` e navega para
  `/login?redirect=<onde estava>`. Não limpa o carrinho de visitante nem o rascunho do checkout
  (`kurio.order-attempt` no `sessionStorage`). Login, cadastro e logout com 401 não entram nesse caminho.
  Um botão de nova tentativa que só repete o 401 não substitui o redirecionamento.
- Rotas privadas (`/checkout`, `/orders/$orderId`, `/account/*`) usam `beforeLoad: requireAuth`. Sem sessão, o
  app redireciona para `/login?redirect=<destino>`. `safeRedirect` só aceita caminho interno que comece com uma
  barra e rejeite `//` e `\`, o que fecha o open redirect.
- Com sessão ativa o cabeçalho mostra o nome da conta (link para `/account/profile`) e **Sair**. Sem sessão,
  mostra **Entrar**.
- Login e cadastro gravam o token, sobem o carrinho de visitante e invalidam `session` e `cart`.
- Logout limpa o token mesmo se a chamada falhar e remove o cache do carrinho.
- Rotas desconhecidas caem na tela em português `NotFoundPage` (dentro do shell da Kurio), com link para `/`.
- **Troca de usuário não vaza dados.** `useRealtime` observa o `userId`; quando ele muda ou some,
  `dropPrivateCache` remove carrinho, cotação, pedidos, carteiras, perfil e favoritos da sessão anterior e os
  avisos de preço. Visitante que entra mantém o que já carregou.

## Carrinho

Dois donos, uma tela:

- **Visitante:** `features/cart/guest-cart.ts` guarda linhas `{ slug, editionId, quantity }` em
  `kurio.guest-cart` e o cupom em `kurio.guest-coupon`, expostos por `useSyncExternalStore`. O preço, o título
  e o estoque são buscados no catálogo na hora de exibir. Só um **404** (NFT ou edição sumiu) remove a linha.
  Falha transitória (rede, 503) sobe como erro da query: o carrinho não aparece vazio enquanto os itens
  continuam no `localStorage`.
- **Usuário:** o carrinho vive no servidor (`/cart`).
- **Merge no login** (`sync.ts` e `merge.ts`): a chave `kurio.guest-cart` é apagada antes de qualquer request,
  então dois logins seguidos nunca enviam o mesmo item duas vezes. O merge soma a mesma edição, limita ao
  estoque atual e descarta linha sem estoque. O id de edição se repete entre NFTs, então a chave da linha é
  `slug~editionId`. Uma linha que dá 409 por estoque fica de fora e as outras seguem. Falha na sincronização
  não derruba o login.
- **Cotação:** `useQuote` usa a chave `["quote", items, couponCode]` com `keepPreviousData`, para o resumo não
  piscar enquanto o cupom é validado. A requisição recebe `AbortSignal`.

## Cache e consistência

- Chaves: `["session"]`, `["nfts", params]`, `["nft", slug]`, `["cart", ...]`, `["quote", items, coupon]`,
  `["favorites", userId]`, `["order", id]`, e as de carteiras e perfil.
- `retry: 1` para leitura e `retry: 0` para mutação. Mutação não repete sozinha.
- O estado do catálogo mora na URL (`?q=&collection=a&collection=b&network=&minPrice=&maxPrice=&page=`): a busca é validada por Zod
  (`catalogSearchSchema`) e serializada sem JSON, com parâmetros repetidos para listas. Voltar e compartilhar
  link funcionam.
- Cada query recebe o `signal` do React Query e o repassa ao Axios. Uma busca nova cancela a anterior, e o
  cenário `out-of-order` prova que uma resposta atrasada não sobrescreve a mais nova.
- **Favoritos** são otimistas: `onMutate` cancela a leitura, grava a lista nova e guarda o snapshot; o erro
  restaura o snapshot. Visitante que favorita vai para `/login` com o destino guardado.
- **Pedido e idempotência.** A UI gera uma `Idempotency-Key` por tentativa (`crypto.randomUUID`) e guarda chave
  e corpo em `sessionStorage` (`kurio.order-attempt`) enquanto o resultado é incerto. Reload de `/checkout`
  reusa a mesma chave e o mesmo corpo: o servidor devolve o pedido já criado (`Idempotency-Replayed: true`).
  Corpo diferente (outra carteira, outra revisão) é outra tentativa e a UI gera chave nova; se a chave antiga
  chegasse com corpo diferente, o servidor responde 409 `idempotency_conflict`. O pedido guarda um `snapshot`
  (itens, cupom e cotação): a tela de recibo lê dele, não do catálogo ao vivo.
- **Cotação revista.** A `version` da cotação é uma impressão digital de linhas (slug, edição, quantidade,
  preço, `priceVersion`), cupom e taxa de rede (`quoteVersionOf`). Qualquer mudança — inclusive no item de
  menor `priceVersion` ou só na quantidade — gera outro número. O checkout manda `quoteVersion`. Se a versão
  da revisão estiver atrás da cotação nova, o servidor responde 409 `quote_changed` e a tela pede para aceitar
  o total novo antes de cobrar.

## Reconciliação REST e Socket.IO

O REST é a fonte da verdade; o socket só avisa. O cliente (`features/realtime/socket.ts`) usa `socket.io-client`
de verdade. Com sessão, o handshake leva `auth: { token }`. Visitante também conecta, sem token, para receber
`nft.updated` público (sem `userId`) no catálogo e no carrinho de visitante. Evento endereçado a outro
`userId` continua ignorado.

Eventos, ambos com `{ eventId, version, resource, userId? }`:

| Evento | Efeito |
| --- | --- |
| `nft.updated` | Atualiza preço (e estoque) no detalhe, em todas as listas, no carrinho do servidor e no de visitante; invalida carrinho e cotação; mostra aviso de preço. |
| `order.updated` | Atualiza `status` e `txRef` do pedido em cache; invalida o carrinho. |

Três filtros decidem se um evento vale, nesta ordem, em `accept` e `shouldApplyVersion`:

1. `userId` presente e diferente do usuário atual: ignora.
2. `eventId` já visto (janela de 200): ignora. Evita reaplicar duplicata.
3. `version` menor ou igual à conhecida: ignora. A versão conhecida é o maior valor entre o que este socket
   viu e o que o cache já mostra, que vem do servidor e sobrevive a um recarregamento. O pedido não tem versão
   própria: `pending` vale 1 e os estados finais, 2.

Um evento fora de ordem ou repetido nunca faz o preço ou o status voltar atrás.

Na **reconexão**, o cliente assume que perdeu eventos e invalida `nfts`, `nft`, carrinho, cotação e pedidos: o
REST responde de novo e o estado converge. Um pedido pendente volta a `GET /orders/:id`; nada cria pedido novo.
O mock também empurra a mudança de pedido, mas o cliente a ignora se já a tem.

## Backend simulado

`src/mocks/README.md` descreve o banco (`localStorage`, chave `kurio.mock`), o seed, os parâmetros de URL e a
tabela de cenários. O ponto de arquitetura: o mock fica atrás de `setupWorker`, então o cliente passa pela pilha
de rede real do navegador (Axios, cabeçalhos, cancelamento, erro de rede), e não por um stub em memória.

## Limitações conhecidas

- **Binding Socket.IO com peer de MSW 2 sobre MSW 3.** `@mswjs/socket.io-binding` declara peer de MSW 2. O
  `package.json` usa `overrides` para apontá-lo para o MSW 3 do projeto. Funciona nos testes e no navegador, mas
  é uma combinação que o pacote não declara suportar; uma versão futura do binding deve remover o `overrides`.
- **O mock não derruba o WebSocket.** Não há como simular queda de conexão, só falha de REST (`offline`,
  `server-error`). A lógica de reconexão (invalidar e refazer consultas em `onConnect`) existe, mas não
  é exercitada de ponta a ponta no navegador.
- **Baselines visuais só para Linux.** Os snapshots de `e2e/specs/13-visual.spec.ts-snapshots` foram gerados em
  Linux. Em outro sistema o spec visual falha por renderização de fonte, sem ser regressão.
- **Cenários só registrados.** `validation-conflict` e `coupon-invalid` aceitam `?scenario=`, mas não têm
  comportamento próprio: os erros que eles nomeiam já saem das regras normais (cadastro, cupom).
- **Desempenho do detalhe.** Veja `docs/lighthouse/REPORT.md`: o esqueleto do detalhe é mais baixo que o
  conteúdo e empurra o rodapé (CLS), e o bundle único de ~1,2 MB pesa no LCP móvel.

## Desvios conhecidos do Figma

O Figma define identidade e composição; o enunciado define comportamento. Estados que o arquivo não desenha
seguem os tokens do projeto. Onde Figma e acessibilidade divergem (contraste, alvo de toque), vale a
acessibilidade.

- **Header com sessão.** O frame público só mostra **Entrar**. Com sessão o cabeçalho mostra o nome da conta e
  **Sair** — o enunciado exige isso, o frame não.
- **Contagens dos filtros.** Os números do Figma (33, 12, 119…) são ilustração. A UI usa as facetas da API.
- **Estados sem frame.** Erro de campo, carregamento (esqueleto com brilho; parado em
  `prefers-reduced-motion: reduce`), vazio, esgotado, 404 interno e página não encontrada foram desenhados com
  os tokens. O resumo do carrinho usa o esqueleto no lugar de um travessão enquanto a cotação carrega.
- **Fundos decorativos.** SVGs e PNGs exportados, com composição adaptada ao layout fluido (não ao
  posicionamento absoluto gerado pelo MCP).
- **Painel de cenários.** Botão flutuante de desenvolvimento; não existe no Figma.
- **Login social.** Os botões existem no card e ficam desabilitados: o mock não tem OAuth.
- **Itens da conta sem tela.** Atividade, lista de interesse, ofertas, arquivos e suporte levam ao diário da
  home (`#diario`).
- **Explorador de transação.** O recibo aponta para Etherscan/Polygonscan/Solscan com o rótulo
  **(simulado)**. Não há blockchain real.
- **`letterSpacing: 10`** nos estilos de 14px do Figma é porcentagem (0.1em) em rótulos, não 10px.
