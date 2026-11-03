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
`emit` dispara um `CustomEvent` `kurio:mock` em `window` com `detail: { type, payload }`.

## Cenários

| Cenário | Comportamento | Estado |
| --- | --- | --- |
| `default` | Fluxo normal. | ativo |
| `empty` | Catálogo, carrinho e favoritos vazios. | registrado, muda na Task 6 |
| `slow-network` | Toda chamada `/api/*` espera 1200 ms. | ativo |
| `out-of-order` | Respostas de busca chegam fora de ordem. | registrado, muda na Task 6 |
| `offline` | Toda chamada `/api/*` falha na rede (`HttpResponse.error()`). | ativo |
| `server-error` | 503 nas duas primeiras leituras de `/api/nfts` e de `/api/nfts/:id`. Veja `shouldFailTransient`. | helper pronto, handlers na Task 6 |
| `session-expired` | Sessão deixa de valer no meio do fluxo. | registrado, muda nas tasks de auth |
| `validation-conflict` | Servidor devolve erro de validação por campo. | registrado |
| `coupon-invalid` | Cupom é recusado. | registrado, muda nas tasks de carrinho |
| `price-changed` | Preço muda entre cotação e confirmação. | registrado |
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
