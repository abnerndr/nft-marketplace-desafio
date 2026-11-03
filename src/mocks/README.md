# Backend simulado (MSW)

A rede é simulada no navegador com MSW. O estado vive em `localStorage`, na chave `kurio.mock`
(`{ scenario, db }`). O worker é iniciado por `enableMocks()` em `src/main.tsx`, antes do `createRoot`,
e só se `VITE_ENABLE_MOCKS !== "false"`. `VITE_DEFAULT_SCENARIO` define o cenário inicial.

## Parâmetros de URL

| Parâmetro | Efeito |
| --- | --- |
| `?reset=1` | Apaga `kurio.mock` e regrava o seed antes do worker responder. |
| `?scenario=<id>` | Grava o cenário e volta ao seed dele. Valor desconhecido é ignorado. |

## Console

`window.__kurio` expõe `reset()`, `setScenario(id)` e `emit(type, payload)`.
`emit` dispara um `CustomEvent` `kurio:mock` em `window` com `detail: { type, payload }` e também
empurra o evento pelo transporte Socket.IO mock (veja abaixo). `emit("nft.updated")` sem `payload`
sobe 10% no preço do primeiro item do carrinho de cada usuário conectado e, se houver visitante
conectado, do carrinho de visitante (evento público).

## Socket.IO

O cliente (`src/features/realtime/socket.ts`) usa `socket.io-client` de verdade e conecta em
`VITE_SOCKET_URL` (padrão `wss://realtime.kurio.local`). Com sessão o handshake leva `auth: { token }`;
visitante conecta sem token. O mock (`src/mocks/socket.ts`) intercepta esse host com `ws.link` do MSW e
`@mswjs/socket.io-binding`. `emit("nft.updated")` sem payload sobe 10% no primeiro item do carrinho de
cada usuário conectado e, se houver socket de visitante, no primeiro item do carrinho de visitante
(evento público, sem `userId`).

**Limitação:** o transporte é interceptado pelo MSW no navegador; não há servidor Socket.IO externo.
Sem o worker ativo (`VITE_ENABLE_MOCKS=false`) o cliente tenta um servidor real. O mock não implementa
salas, namespaces, ping nem reconexão com recuperação de eventos perdidos; o cliente refaz as
consultas ao reconectar.

Eventos, ambos com `{ eventId, version, resource, userId? }`:

| Evento | `resource` | Efeito no cliente |
| --- | --- | --- |
| `nft.updated` | `{ slug, priceEth, available? }` | Atualiza catálogo, detalhe, carrinho e cotação; mostra aviso de preço. |
| `order.updated` | `{ id, status, txRef? }` | Atualiza o pedido em cache. Pendente vale versão 1; confirmado e recusado, 2. |

O cliente ignora evento com `userId` diferente do usuário atual (visitante ignora qualquer evento com
`userId`), `eventId` repetido e `version` menor ou igual à já aplicada (`shouldApplyVersion`). No mock,
`nft.updated` grava o preço e a versão do NFT no banco e a `version` da cotação é a impressão digital
de linhas, cupom e taxa, então um checkout revisado numa versão antiga recebe `quote_changed` (409).
No cenário `price-changed`, 1,5 s depois de o usuário conectado ter um item no carrinho, o mock empurra
`nft.updated` do primeiro item (+10%), uma vez por usuário.

## Cenários

| Cenário | Comportamento | Estado |
| --- | --- | --- |
| `default` | Fluxo normal. | ativo |
| `empty` | `GET /api/nfts` devolve `items: []`, `total: 0` e facetas zeradas. Carrinho e favoritos ainda não mudam. | ativo (catálogo) |
| `slow-network` | Toda chamada `/api/*` espera 1200 ms. | ativo |
| `out-of-order` | Cada `GET /api/nfts` espera menos que o anterior (900, 400, 50 ms e depois 50 ms; `nextOutOfOrderDelay`), então uma busca nova pode responder antes de uma antiga. O contador zera ao trocar de cenário. | ativo |
| `offline` | Toda chamada `/api/*` falha na rede (`HttpResponse.error()`). | ativo |
| `server-error` | 503 nas duas primeiras leituras de `/api/nfts` (lista), com contador próprio para `/api/nfts/:id`. Veja `shouldFailTransient`. O handler de lista está ativo; o de detalhe ainda não existe. | ativo (lista) |
| `session-expired` | Sessão deixa de valer no meio do fluxo. | registrado, muda nas tasks de auth |
| `validation-conflict` | Servidor devolve erro de validação por campo. | registrado |
| `coupon-invalid` | Cupom é recusado. | registrado, muda nas tasks de carrinho |
| `price-changed` | Preço muda entre cotação e confirmação: a cotação com revisão devolve a versão 2 e taxa 0,03 ETH, e o primeiro item do carrinho sobe 10% por `nft.updated` no Socket.IO. | ativo |
| `edition-sold-out` | Edição esgota antes do pagamento. | registrado |
| `order-timeout` | Pedido fica pendente até estourar o tempo. | registrado |
| `payment-confirmed` | Pagamento é confirmado. | registrado |
| `payment-declined` | Pagamento é recusado. | registrado |

Os cenários "registrados" já existem em `SCENARIO_IDS` e são aceitos por `?scenario=`. O comportamento
entra nas tasks que criam os handlers correspondentes.

## Seed

`createSeed()` devolve 36 NFTs (4 páginas de 9), 2 usuários, carrinhos vazios e nenhum pedido.

- Marina: 1 favorito (`emerald-ape-042`) e duas carteiras.
- Rafael: sem carteira e sem favorito.
- Senhas guardam só o hex SHA-256. Nunca o texto.
- `imageUrl` aponta para SVGs locais em `public/nfts/`, um por título da home.
