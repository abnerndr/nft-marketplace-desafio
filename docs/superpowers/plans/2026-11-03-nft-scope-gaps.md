# NFT Marketplace Scope Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Este documento é um plano; sua criação não inicia a implementação.

**Goal:** Fechar as lacunas demonstradas na auditoria e entregar os fluxos do enunciado com fidelidade ao Figma, consistência financeira, privacidade e evidências reproduzíveis.

**Architecture:** Preservar React/Vite, os limites de features e o backend simulado na rede. Tornar sessão, estoque por edição, dinheiro e transições de pedido invariantes explícitas; REST continua sendo a fonte da verdade, com Socket.IO emitindo somente transições persistidas. Completar a apresentação com componentes shadcn/ui adaptados e assets locais do Figma.

**Tech Stack:** React, TypeScript, TanStack Router/Query, Axios, REST, Socket.IO, Tailwind CSS, shadcn/ui, MSW, Playwright, Lighthouse, Decimal.js e Zod.

**Spec:** [Enunciado](../../../Desafio%20Frontend%20%E2%80%94%20Marketplace%20de%20NFTs.md), [auditoria e matriz D01–D26](../../auditoria-escopo-2026-11-03.md), [Figma escolhido pelo usuário](https://www.figma.com/design/29GDGWiDm9YFc1IsHGrFby/Desafio-NFT?node-id=0-1).

## Global Constraints

- “As tecnologias devem participar efetivamente da solução.” shadcn/ui deve fornecer componentes reais da interface, além da configuração/CSS.
- “APIs, autenticação, carteiras e pagamentos devem funcionar com dados simulados.” Sem blockchain, extensão ou gateway real.
- “Valores em ETH devem trafegar como strings decimais e manter precisão nos cálculos e na apresentação. Quantidades são inteiras.”
- “Mudanças devem exigir nova confirmação do usuário.” Uma invalidação de cache não equivale a aceitar nova cotação.
- “Pedidos confirmados ou recusados são terminais.” Uma versão superior não autoriza regressão.
- “Logout e troca de usuário devem limpar dados privados em cache e subscriptions da sessão anterior.” Responses e callbacks tardios fazem parte desse requisito.
- “O reset deve restaurar integralmente um cenário conhecido.”
- “Os cenários devem exercitar `socket.io-client`.” Não escrever diretamente no cache/UI para simular eventos.
- “Avalie, no mínimo, larguras de 390, 768 e 1440 pixels.” Também comparar a 414 px, dimensão dos frames mobile.
- “O recibo deve reproduzir o snapshot do pedido.” Não recalcular pedido antigo pelo catálogo atual.
- Lighthouse: Performance ≥90, Accessibility ≥95, Best Practices ≥95, SEO ≥90; três medições por página/perfil e mediana.
- “O deploy é obrigatório.” Código entregue, mocks, realtime, acesso direto e refresh devem funcionar na URL pública.
- Não criar páginas editoriais, suporte, atividade, ofertas ou downloads. Ações auxiliares devem comunicar indisponibilidade.
- Não substituir assets disponíveis por desenhos genéricos. Não usar screenshots Figma como assets de implementação.
- Não atualizar baselines para aprovar diferenças ainda não revisadas contra o Figma.
- Implementação futura em branch/worktree isolada, sem iniciar em `master`; nenhuma publicação/push/merge é feita por este plano.

## Execução e dependências

Usar um implementador novo por tarefa; não despachar implementadores concorrentes. Cada tarefa passa por revisão de conformidade e qualidade; ao final, revisão do conjunto. Criar ledger próprio deste plano com o helper `sdd-workspace`, sem reutilizar o ledger do plano anterior.

| Tarefa | Depende de | Achados / responsabilidade |
| --- | --- | --- |
| 1 | — | D02/D17: identidade, cache e respostas antigas |
| 2 | — | D04: precisão ETH |
| 3 | 2 | D05/D06/D16: estoque por edição, reserva e cotação |
| 4 | 1, 3 | D03: tentativa desconhecida e idempotência |
| 5 | 1, 3 | D15: merge de visitante recuperável |
| 6 | 1, 3, 4 | D07–D10: eventos persistidos, terminalidade e reconexão |
| 7 | 4–6 | D18: cenários, reset integral e relógio |
| 8 | — | D01/D12/D13: shadcn, assets e shell |
| 9 | 8 | D21/D23: auth/modal, galeria e recibo |
| 10 | 1–4, 8 | D14: checkout completo e revisão |
| 11 | 1, 8–10 | D19/D20/D22: conta, erros, acessibilidade e tablet |
| 12 | 8–11 | D25: layout shift, bundle e Lighthouse |
| 13 | 1–12 | D24/D26: E2E, baselines, artefatos e documentação |
| 14 | 13 | D11: deploy e validação pública da revisão final |

Os arquivos abaixo são fronteiras previstas, não autorização para refatorar áreas sem relação. Se um teste demonstrar que um risco não ocorre na UI, registrar a prova e ajustar a correção, sem manter mudanças desnecessárias.

### Task 1: Isolar sessões e descartar responses/mutations da conta anterior

**Files:** criar `src/features/auth/session-identity.ts` e teste; modificar `src/features/auth/session.ts`, `src/app/session-expiry.ts`, `src/shared/api/client.ts`, `src/features/profile/api.ts`, `src/features/wallets/api.ts`, `src/features/cart/api.ts`, `src/features/cart/quote.ts`, `src/features/orders/api.ts`, `src/features/favorites/use-favorite.ts`, `src/features/realtime/private-cache.ts`, `src/features/realtime/socket.ts`, `src/features/realtime/use-realtime.ts`; criar `e2e/specs/14-session-races.spec.ts`.

**Interfaces:** produzir `SessionIdentity`, `captureSessionIdentity()`, `isCurrentSession(identity)` e `privateQueryKey(userId, ...parts)`. O campo generation muda em login/logout/expiração; request e mutation capturam a identidade ao iniciar. Todas as tarefas privadas seguintes consomem essas interfaces.

- [ ] Reproduzir A→B com PATCH/avatar e GET sessão retidos na camada de rede: autenticar A, processar request, trocar via SPA para B, liberar resposta A; assertar perfil/email B e sessão B. Repetir com 401 de A. Evitar `page.goto` entre troca e callback, pois destruir a página esconderia a corrida.
- [ ] Criar o núcleo tipado abaixo e teste de identidade obsoleta. Não persistir token nos relatórios.

```ts
export type SessionIdentity = Readonly<{ userId: string | null; generation: number }>;
let current: SessionIdentity = { userId: null, generation: 0 };
export function setSessionIdentity(userId: string | null) {
  current = { userId, generation: current.generation + 1 };
}
export const captureSessionIdentity = (): SessionIdentity => ({ ...current });
export const isCurrentSession = (value: SessionIdentity) =>
  value.userId === current.userId && value.generation === current.generation;
export const privateQueryKey = (userId: string, ...parts: unknown[]) =>
  ['private', userId, ...parts] as const;
```

- [ ] Particionar perfil, carteiras, carrinho, cotação privada, pedido e favoritos. Guardar identidade nos callbacks `onMutate/onSuccess/onError/onSettled`; rollback antigo não deve escrever no cache da conta nova. Interceptor 401 só expira se request pertence à generation/token atual. GET sessão deve consumir `AbortSignal`.
- [ ] Atualizar cleanup e socket para as novas chaves; cancelar leituras antigas, limpar subscriptions e impedir reativação pelo callback antigo. Preservar carrinho visitante e dados públicos.
- [ ] Rodar `npm test` e `npm run test:e2e -- e2e/specs/03-autenticacao.spec.ts e2e/specs/14-session-races.spec.ts --workers=2`. Critério: nenhuma resposta A altera dados/sessão de B; expiração corrente continua redirecionando com destino.
- [ ] Revisar e registrar commit isolado da correção.

### Task 2: Preservar precisão de ETH nas taxas e na apresentação

**Files:** modificar `src/shared/domain/money.ts`, `src/shared/domain/money.test.ts`, `src/mocks/handlers/quote.ts`, `src/mocks/handlers/quote.test.ts`, `src/mocks/nft-version.ts`, `e2e/specs/05-carrinho.spec.ts`, `e2e/specs/06-compra.spec.ts`; documentar em `ARCHITECTURE.md`.

**Interfaces:** manter `addEth/subEth/cmpEth/formatEth`; `mulEth` passa a aceitar somente quantidade inteira; produzir `mulEthRate(amount: string, rate: string): string`. Contratos permanecem strings decimais, nunca float ETH.

- [ ] Acrescentar expectativas matemáticas independentes:

```ts
expect(mulEthRate('2.38', '0.10')).toBe('0.238');
expect(subEth(addEth('2.38', '0.02'), '0.238')).toBe('2.162');
expect(formatEth('0.00001')).toBe('0.00001 ETH');
expect(mulEth('0.000000000000000001', 3)).toBe('0.000000000000000003');
```

- [ ] Implementar multiplicação sem arredondar à escala da entrada e apresentação decimal completa, sem notação exponencial. Definir precisão máxima de transporte em 18 casas e rejeitar valores que excedam a política em vez de truncar silenciosamente.

```ts
export const mulEthRate = (amount: string, rate: string) =>
  new Decimal(amount).times(new Decimal(rate)).toFixed();
export function formatEth(amount: string) {
  return `${new Decimal(amount).toFixed()} ETH`;
}
```

- [ ] Trocar `Number(rate)` na cotação e percentual no aumento de preço pela função decimal. Manter quantidade como inteiro validado; atualizar os testes que hoje esperam `0.24` para `0.238` e total `2.162`.
- [ ] Rodar `npm test` e specs 05/06; comparar subtotal/desconto/taxa/total da API com carrinho, revisão e snapshot. Revisar e registrar commit.

### Task 3: Persistir estoque por edição e validar/reservar atomicamente

**Files:** modificar `src/mocks/seed.ts`, `src/mocks/db.ts`, `src/mocks/handlers/nfts.ts`, `src/mocks/handlers/cart.ts`, `src/mocks/handlers/quote.ts`, `src/mocks/handlers/orders.ts`, `src/shared/domain/contracts.ts` e testes dos handlers; criar `src/mocks/inventory.ts` e teste.

**Interfaces:** produzir `EditionStock`, `InventoryLine`, `validateInventory(lines)`, `reserveInventory(orderId, lines)`, `releaseInventory(orderId)`, `commitInventory(orderId)` e `availableEditions(slug)`. Persistir versões de estoque e reservas no banco mock. Os métodos retornam resultado com conflito por linha e nunca deixam saldo negativo.

```ts
type EditionStock = { slug: string; editionId: string; remaining: number; version: number };
type InventoryLine = { slug: string; editionId: string; quantity: number };
type InventoryResult =
  | { ok: true }
  | { ok: false; conflicts: Array<InventoryLine & { available: number }> };
```

- [ ] Criar testes de edição inicialmente 2: comprar 1 deixa 1, nova compra de 2 retorna conflito. Criar teste saldo agregado 5 com linhas 5+5 de edições diferentes: retornar 409, nenhum pedido confirmado nem baixa parcial.
- [ ] Definir seed com saldo independente por edição e teto agregado do NFT; manter 1/1 esgotada. Atualizar versão do banco e documentar migração/reset da demonstração.
- [ ] Validar integralmente payload de `/quote`: slug/edição existentes, inteiros ≥1, limites por edição e soma agregada. Payload malformado →422; recurso desconhecido →404; saldo insuficiente →409 com conflitos. Não descartar linhas silenciosamente.
- [ ] Reservar saldo na criação de pending, sem contagem dupla no commit. Recusa libera reserva. Confirmar consome uma única vez. Provar que dois usuários/pedidos concorrentes não podem reservar as mesmas unidades.

```ts
expect(reserveInventory('order-a', lines)).toEqual({ ok: true });
expect(reserveInventory('order-b', lines).ok).toBe(false);
commitInventory('order-a');
commitInventory('order-a'); // aplicação única, sem segunda baixa
expect(availableEditions(slug).find(e => e.id === editionId)?.available).toBe(0);
```

- [ ] Rodar testes dos handlers e `npm test`; validar estoque antes/depois de confirmado/recusado/pending/refresh. Commit após revisão.

### Task 4: Recuperar tentativa desconhecida antes de permitir nova intenção de compra

**Files:** modificar `src/features/orders/idempotency.ts`, teste correspondente, `src/features/orders/api.ts`, `src/features/checkout/payment-page.tsx`, `src/mocks/handlers/orders.ts`; ampliar `e2e/specs/07-falha-pagamento.spec.ts` e `10-eventos-pedido-pendente.spec.ts`.

**Interfaces:** `OrderAttempt` passa a incluir `userId`, `key`, `body`, `orderId?`, `state: 'unknown' | 'pending'`. Storage particionado por usuário. Produzir `recoverOrderAttempt(attempt)` que reenvia **exatamente** corpo/chave original via Axios, recupera o mesmo ID e respeita a sessão dona. Não gerar nova chave enquanto o resultado anterior for desconhecido.

- [ ] Reproduzir no browser timeout depois da gravação, refresh, preço alterado, seleção de outra carteira e novo clique. Assertar um único pedido e baixa única. Repetir após expiração e login da mesma conta; outra conta não recupera pedido privado.
- [ ] Substituir troca automática por corpo diferente pelo bloqueio de tentativa ativa. Teste de contrato:

```ts
const first = resolveOrderAttempt(bodyA);
// Enquanto first é desconhecida, bodyB não pode substituir first no storage.
expect(() => resolveOrderAttempt(bodyB)).toThrow('order_outcome_unknown');
expect(readOrderAttempt()?.key).toBe(first.key);
```

- [ ] Recuperar tentativa ao entrar no checkout antes de habilitar confirmação; renderizar “Recuperando pedido anterior” e retry seguro. Resultado confirmado vai ao snapshot; recusado libera nova intenção; pending segue consulta do mesmo ID. Timeout de recuperação preserva tentativa.
- [ ] Manter idempotência do servidor por dono+chave+corpo; conteúdo diferente com mesma chave continua 409. Reenvio da tentativa antiga deve funcionar antes de validar cotação/carteira que mudaram depois da criação.
- [ ] Rodar Vitest e specs 06/07/10; exigir `orders.length===1` no caso timeout+mudança e snapshot inalterado. Revisar e commitar.

### Task 5: Fazer merge do visitante com recuperação de falha parcial e resposta perdida

**Files:** modificar `src/features/cart/sync.ts`, `guest-cart.ts`, `merge.ts`, seus testes, `src/features/auth/session.ts`, `src/mocks/handlers/cart.ts`; ampliar `e2e/specs/05-carrinho.spec.ts` e contratos/documentação.

**Interfaces:** produzir `GuestMergeAttempt { userId, mergeId, lines, couponCode }`, endpoint `POST /cart/merge` com `Idempotency-Key: mergeId`, resultado `{ cart, adjustments }`. O mock aplica merge inteiro atomicamente; replay recupera o mesmo resultado. Persistir tentativa antes do envio e limpar somente após resposta confirmada.

- [ ] Criar teste duas linhas, primeira processada e falha antes da segunda: nenhuma linha pode desaparecer. Criar falha após commit e antes da resposta: reenvio não duplica quantidades.
- [ ] Mover merge para transação mock com validação de estoque da tarefa 3; armazenar resultado por usuário+mergeId. Retornar ajustes de estoque em vez de descartar silenciosamente.

```ts
const headers = { 'Idempotency-Key': attempt.mergeId };
const first = await api.post('/cart/merge', attempt, { headers });
const replay = await api.post('/cart/merge', attempt, { headers });
expect(replay.data.cart).toEqual(first.data.cart);
```

- [ ] Login permanece válido mesmo se merge falhar, mas mostra alerta e “Tentar sincronizar novamente”; conservar guest lines/tentativa até confirmação e não enviá-las para outro usuário por engano.
- [ ] Rodar testes de merge/sync/cart e spec 05 desktop/mobile. Critério: falha preserva itens, retry não duplica, ajustes são informados. Revisar e commitar.

### Task 6: Unificar transições REST/Socket.IO e exercitar reconexão real

**Files:** modificar `src/mocks/socket.ts`, `nft-version.ts`, `handlers/orders.ts`, `src/features/realtime/socket.ts`, `notices.ts`, `price-notice.tsx`, testes e `e2e/specs/09-preco-socket.spec.ts`, `10-eventos-pedido-pendente.spec.ts`; criar `src/mocks/resource-events.ts`.

**Interfaces:** produzir `commitNftUpdate(input)` e `transitionMockOrder(id,next)` na camada mock. Primeiro persistem dado+versão, depois publicam evento. Evento NFT inclui edições/disponibilidade; Order inclui dono e versão persistida. Produzir controles mock `disconnectSocket()` e `reconnectSocket()` que fecham/reabrem o transporte Socket.IO, sem chamar invalidadores/setters manualmente.

- [ ] Provar REST e evento idênticos para preço e estoque; evento manual `order.updated` passa pela transição persistida do mock. Repetir confirmação/recusa não reaplica compra.
- [ ] Testar terminalidade com versão maior, não só antiga:

```ts
expect(canTransitionOrder('confirmed', 'pending')).toBe(false);
expect(canTransitionOrder('declined', 'confirmed')).toBe(false);
expect(canTransitionOrder('pending', 'confirmed')).toBe(true);
export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return from === 'pending' && (to === 'confirmed' || to === 'declined');
}
```

- [ ] Cliente reconcilia detalhe/edições/carrinho/cotação e invalida listas com filtros/ordenação após NFT mudar. Provar que item sai de `maxPrice` e muda posição em `price_asc`; não basta trocar preço na posição atual. Compra deve emitir baixa de estoque e aviso acessível.
- [ ] Abrir pending, derrubar WebSocket via MSW, alterar pedido na simulação enquanto desconectado, reconectar; exigir nova consulta REST e mesmo ID confirmado, sem outro POST. Repetir com recusado. Testar duplicatas, versões antigas e evento da sessão anterior.
- [ ] Rodar testes socket/version e specs 09/10; registrar frames/requests como evidência do transporte. Documentar limitações do binding e compatibilidade MSW, revisar e commitar.

### Task 7: Entregar reset integral e cenários determinísticos

**Files:** modificar `src/mocks/browser.ts`, `db.ts`, `scenarios.ts`, `socket.ts`, `handlers/scenario.ts`, `src/features/realtime/scenario-panel.tsx`, `e2e/fixtures.ts`, `src/mocks/README.md`, `README.md`; criar testes de reset.

**Interfaces:** `window.__kurio.reset()` limpa integralmente apenas chaves Kurio, tentativas por conta, timers, cenários, conexões e caches. `setScenario` inicia cenário conhecido; controle separado `switchScenario` mantém dados para teste de falha durante fluxo. Nenhuma necessidade de importar `/src/...` nos testes de build.

- [ ] Preparar guest cart/cupom, usuário, wallet, pending, tentativa e timer; resetar; assertar seed conhecido, sessão vazia e nenhum callback antigo alterando o seed.

```ts
const KURIO_PREFIX = 'kurio.';
for (const store of [localStorage, sessionStorage]) {
  for (const key of Object.keys(store)) if (key.startsWith(KURIO_PREFIX)) store.removeItem(key);
}
// A implementação também cancela timers, fecha peers e recria o seed antes de retomar UI.
```

- [ ] Implementar cenário próprio para conflito de validação, cupom inválido/expirado, 403, estoque alterado e desconexão; garantir nomes que selecionam erros realmente os provocam.
- [ ] Instalar relógio Playwright antes da página nos casos sensíveis; avançar timers de preço, timeout e pedido controladamente. Não esperar oito segundos reais para provar timeout. Esperar ambas respostas no teste fora de ordem.
- [ ] Rodar testes mocks e specs 01/07/09/10/12; confirmar mesmos cenários no preview otimizado. Revisar e commitar.

### Task 8: Usar shadcn/ui efetivamente e reconstruir assets/shell conforme Figma

**Files:** criar `src/components/ui/{button,input,dialog,sheet,skeleton}.tsx`, `src/components/mobile-navigation.tsx`, `src/shared/domain/nft-assets.ts`; modificar `src/app/shell.tsx`, `src/components/site-header.tsx`, `site-footer.tsx`, `src/features/catalog/{home-page,nft-card,filters}.tsx`, `src/mocks/seed.ts`, `src/index.css`; assets em `src/assets`/`public/nfts`.

**Interfaces:** componentes shadcn adaptados aos tokens atuais. Produzir mapa local `nftAssets: Record<string,string>` que o seed usa para `imageUrl`, propagando as artes reais pela API. Shell escolhe composição por rota e breakpoint, preservando navegação/URLs do Router.

- [ ] Consultar novamente contextos/screenshot MCP dos frames 1:661, 1:1531 e componentes compartilhados; ler `figma-design-to-code` antes de `get_design_context`. Reutilizar exports locais quando forem os mesmos; baixar assets faltantes conforme instrução MCP.
- [ ] Trocar URLs genéricas pelas artes corretas com mapeamento explícito por slot. Exemplo de seed, sujeito ao slot exato de cada frame:

```ts
import emerald from '@/assets/home/hero-art.png';
import sage from '@/assets/home/art-purple.png';
import neon from '@/assets/home/art-dark.png';
import golden from '@/assets/home/art-orange.png';
export const nftAssets = {
  'emerald-ape-042': emerald,
  'sage-nomad-009': sage,
  'neon-vessel-552': neon,
  'golden-signal-160': golden,
};
```

- [ ] Criar componentes shadcn reais e compô-los nas interações/formulários/modal/drawer. Manter identidade do Figma; não adotar aparência padrão. Import CSS sozinho não satisfaz esta tarefa.
- [ ] Desktop: header com margem 24px, conteúdo1200, ativo Mercado nas rotas de compra e Início na conta/auth; footer contido no canvas previsto. Mobile: busca “Explorar coleções” e filtro na mesma linha, bottom nav acessível, estados ativos e espaço seguro para barras fixas. Ações fora do escopo desabilitadas/explicadas, sem falso sucesso.
- [ ] Comparar catálogo/cards/hero a1440 e414, testar390 e768 e completar assets de todos os slugs/variantes sem usar fallback genérico. Rodar typecheck/lint e specs01/02; revisar imagens lado a lado antes de commit.

### Task 9: Completar auth, galeria e recibo com composição e foco corretos

**Files:** modificar `src/features/auth/{auth-card,login-page,register-page}.tsx`, `src/features/nft/detail-page.tsx`, `src/features/orders/confirmation-page.tsx`, `src/shared/domain/contracts.ts`, `src/mocks/handlers/nfts.ts`; criar `src/features/nft/gallery.tsx`; ampliar specs02/03/11.

**Interfaces:** detalhe fornece `images: Array<{id,url,alt}>`; galeria seleciona por ID e usa Dialog para zoom. Auth desktop usa marketplace como fundo e Dialog shadcn; mobile é página própria sem chrome desktop. Recibo desktop reproduz composição modal com foco gerido, sem anunciar compra antes do estado confirmado.

- [ ] MCP dos frames1:844/1629/1248/1282/1907/1927/1153. Preservar imagens repetidas onde o desenho repete, adicionando interação de seleção e zoom; não inventar imagens alternativas desnecessárias.
- [ ] Teste de galeria: escolher miniatura por botão com nome acessível, imagem principal corresponde à seleção, Enter abre zoom, Escape fecha e foco volta ao acionador.

```tsx
<button type="button" aria-label={`Ver imagem ${index + 1}`} aria-pressed={active.id === item.id}
  onClick={() => setActiveId(item.id)}>
  <img src={item.url} alt="" />
</button>
```

- [ ] Auth desktop deve ter o catálogo ao fundo, foco inicial no campo, Tab contido, Escape/Fechar com destino seguro e retorno ao elemento que abriu. Mobile mantém KURIO/títulos/spacing do frame sem desktop footer. Recuperação de senha/social continuam indisponíveis de forma explícita, sem implementar OAuth fora do escopo.
- [ ] Recibo mantém snapshot e valores completos; labels de simulação permanecem, imagens corretas, título/ID legíveis em390. Dialog acessível no desktop e adaptação mobile sem perda de conteúdo.
- [ ] Rodar specs02/03/06/11, comparar screenshots desktop/mobile e revisar antes de commit.

### Task 10: Implementar dados do colecionador e revisão explícita no checkout

**Files:** criar `src/features/checkout/collector-fields.tsx`, `types.ts`; modificar `payment-page.tsx`, `src/features/orders/api.ts`, `src/shared/domain/contracts.ts`, `src/mocks/handlers/orders.ts`, `src/features/profile/api.ts`; ampliar specs06/07/09/11.

**Interfaces:** produzir `CollectorInput` com nome de exibição, nome de usuário, nome do perfil, e-mail, indicação, ENS, endereço secundário e observação. Rede, endereço principal e provider vêm da carteira selecionada; snapshot de pedido guarda dados submetidos. Separar formulário de colecionador de “Adicionar carteira”.

- [ ] MCP dos frames1:1150/1785. Acrescentar os campos do frame desktop, obrigatoriedade visível, validação Zod, erros por campo da API e rascunho por usuário para retomar após expiração. Campos opcionais do Figma permanecem opcionais.
- [ ] Definir `reviewedQuote` como snapshot aceito, separado da query atual. Refetch/evento somente produz mudança pendente; compra fica bloqueada até ação “Confirmar novos valores”.

```ts
const needsReview = currentQuote.version !== reviewedQuote.version;
const canSubmit = collectorValid && wallet.connected && !needsReview && !activeUnknownAttempt;
// Aceitação exige ação explícita, nunca efeito disparado pelo refetch.
function acceptQuote() { setReviewedQuote(currentQuote); }
```

- [ ] Mobile mantém cartões de carteira/provider do frame e oferece painel de revisão expansível acessível com itens, edição, quantidade, subtotal, desconto, taxa e total. Formulário de adicionar carteira abre sob demanda; não ocupa permanentemente o fluxo principal.
- [ ] Provar edição esgotada durante checkout, cupom expirado, preço/taxa alterados, recusa/desconexão e expiração com retomada. Confirmar que nenhuma mudança cria pedido antes da nova aceitação e que campos inválidos não enviam POST.
- [ ] Rodar specs06/07/09/11 em desktop/mobile e testes de contratos. Revisar contra os dois frames antes de commit.

### Task 11: Fechar dados de carteiras, recuperação, acessibilidade e tablet

**Files:** modificar `src/features/wallets/types.ts`, `src/features/wallets/api.ts`, `src/features/wallets/wallets-page.tsx`, `src/mocks/handlers/wallets.ts`, `src/features/profile/profile-page.tsx`, `src/features/account/account-layout.tsx`, `src/features/favorites/use-favorite.ts`, `src/features/catalog/{home-page,nft-card}.tsx`, `src/features/nft/detail-page.tsx`, `src/features/cart/cart-page.tsx`; ampliar specs04/08/11/12.

**Interfaces:** `WalletUpdate` inclui todos os campos de carteira criados; formulário de edição é preenchido com a carteira persistida. `useFavorite` expõe `error`, `isError`, `retry`; erros de queries não viram “não favorito”. Estados de loading/retry consistentes nas telas privadas.

- [ ] Testar editar/recarregar alias, profileName, secondaryAddress, referralCode, email e ENS, além de label/address/network; principal/secundária continuam selecionáveis no checkout. Associar erros API aos respectivos campos.
- [ ] Trocar falhas silenciosas por mensagens `role=alert` e botão concreto de retry; skeletons em perfil/carteiras; feedback de mutations e estoque com live region. Restabelecer foco no campo inválido e foco visível em controles customizados.
- [ ] Corrigir overflow768: grid do perfil só divide quando coluna comporta avatar+ações; controles do avatar podem quebrar linha. Promos768 devem empilhar imagem/texto ou usar largura proporcional, sem esconder CTA. Quantidade inválida após queda de estoque deve poder ser corrigida diretamente ao saldo atual.

```ts
await page.setViewportSize({ width: 768, height: 1080 });
await page.goto('/account/profile');
await expect(page.getByRole('button', { name: 'Remover', exact: true })).toBeInViewport();
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
```

- [ ] Inspecionar todas as telas em390/768/1440, reflow a200% de zoom, foco de Dialog/Sheet, contraste, `prefers-reduced-motion` e conteúdo sob barras fixas. Testar clipping interno, não apenas docWidth.
- [ ] Rodar specs04/08/11/12, revisar Figma de perfil/carteiras e commit.

### Task 12: Reduzir CLS/custo inicial e atingir metas Lighthouse

**Files:** modificar `src/features/nft/detail-page.tsx`, `src/app/router.tsx`, `src/main.tsx`, `src/mocks/browser.ts`, `vite.config.ts`, assets grandes e `scripts/lighthouse.mjs`; atualizar `docs/lighthouse/{REPORT.md,results.md,results.json}` somente com medições reais.

**Interfaces:** preservar rotas e comportamento mock; split por tela e carregamento condicional dos mocks. Imagens podem ser otimizadas com mesma arte/posição/proporção, mantendo fonte original disponível.

- [ ] Registrar baseline Lighthouse da revisão atual. Skeleton do detalhe deve reservar galeria, informações, seções e recomendações com geometria compatível; não empurrar o footer de450px para1600px quando dados chegam.
- [ ] Introduzir imports lazy nas telas de checkout/conta/pedidos e importar MSW condicionalmente antes de renderizar apenas no build de demonstração. Não desligar os mocks na auditoria.

```ts
if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
  const { enableMocks } = await import('@/mocks/browser');
  await enableMocks();
}
```

- [ ] Redimensionar/converter PNGs grandes para dimensões efetivamente usadas com variantes responsivas; validar aparência contra os assets Figma e navegação offline/local. Corrigir heading-order e targets dos sliders.
- [ ] Rodar `npm run lighthouse` sem disputa de CPU, três medições × início/detalhe × mobile/desktop. Exigir medianas ≥90/95/95/90; se houver resultado abaixo, investigar audit específico e repetir só após mudança que o justifique. Registrar LCP/CLS/TBT, versões, ambiente, custo dos mocks e variação.
- [ ] Revisar relatórios e screenshots; commitar configuração/medianas/análise e preservar HTML/JSON completos como artefato.

### Task 13: Fechar regressões, baselines e documentação da entrega

**Files:** modificar `e2e/fixtures.ts`, `playwright.config.ts`, specs01–14, `e2e/specs/13-visual.spec.ts-snapshots/*`, `README.md`, `ARCHITECTURE.md`, `src/mocks/README.md`; criar `.github/workflows/verify.yml` e `scripts/package-evidence.mjs`.

**Interfaces:** suíte executável contra dev e build mock, com reset isolado e controles públicos da simulação. Artefato de entrega contém Playwright HTML/traces, Lighthouse HTML/JSON/medianas e manifesto de revisão, ferramentas e ambiente.

- [ ] Mapear os12 grupos do enunciado às asserções: incluir precisamente dinheiro, estoque, concorrência, sessãoA→B, merge parcial, timeout+mudança, terminalidade v3+, disponibilidade, queda real, checkout expirado, dados de carteira, snapshot e foco modal.
- [ ] Manter relógio/latência/eventos controlados. Inspecionar resultados via UI e REST/MSW e eventos via Socket.IO; não editar localStorage para fingir uma operação bem-sucedida. Consulta ao banco é evidência complementar.
- [ ] Depois da revisão Figma, gerar baselines novas das quatro telas obrigatórias em390/1440; adicionar smoke de todas as rotas em768. Não aumentar tolerância para esconder diferenças. Revisar especialmente header autenticado válido que hoje causa as quatro falhas.
- [ ] Executar instalação a partir de checkout limpo com Node24/npm e lockfile; tipos, lint, testes, build e E2E. CI deve armazenar artefatos mesmo na falha:

```yaml
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: nft-validation-evidence
    path: |
      playwright-report/
      test-results/
      reports/lighthouse/
      docs/lighthouse/
```

- [ ] Documentar contratos novos, sessão/cache por usuário, estoque/reservas, idempotência/merge, cenários/reset/reconexão e desvios justificados do Figma. Remover trechos que dizem que handlers existentes ainda serão implementados. Guardar relatórios fora do Git por artefatos é aceitável se houver link acessível da entrega.
- [ ] Rodar revisão final do conjunto com subagente separado; nenhuma lacuna D01–D26 pode ser fechada apenas por texto ou teste que repete a implementação. Commit do pacote de verificação/documentação.

### Task 14: Publicar a revisão verificada e testar ambiente público

**Files:** conferir `vercel.json`, `.env.example`, `README.md`; criar `docs/deployment.md` com URL, SHA da revisão e data da validação.

**Interfaces:** URL pública de demonstração corresponde ao commit entregue; REST e socket continuam no mock do navegador. Rotas diretas retornam SPA; MSW worker/JS/assets mantêm respostas apropriadas.

- [ ] Preparar preview/build final e pacote de evidências com SHA. Usar skills Vercel de deployments/CLI/bootstrap somente se Vercel for o destino escolhido e ler instruções antes dos comandos de plataforma.
- [ ] Solicitar autorização de publicação somente depois de apresentar o resultado concreto da revisão, se ainda não existir autorização explícita na sessão. Não publicar como efeito da auditoria.
- [ ] Publicar revisão autorizada, registrar URL e testar `/`, detalhe direto, `/cart`, `/checkout`, `/login`, `/register`, perfil/carteiras/pedido com refresh e guardas de autenticação.
- [ ] Executar compra, atualização NFT por Socket.IO e queda/retomada pending no ambiente publicado; comprovar mocks ativos e nenhuma dependência de backend privado. Vincular repo, revisão e artefatos à documentação de entrega.
- [ ] Encerrar com matriz atualizada: corrigido + evidência real ou limitação explícita. Não marcar deploy concluído com apenas configuração local.

## Critérios para encerrar os ajustes

- Stack inteira usada efetivamente e nenhuma exposição A→B, confirmação fora da simulação ou evento simulado diretamente na UI.
- Compra sem perda de precisão, sobrevenda, perda de carrinho ou pedido duplicado nos cenários previstos.
- Todos os15 frames comparados pelo MCP, quatro larguras inspecionadas e sem clipping/overflow indevido.
- Suítes e regressões executáveis, baselines revisadas, HTML/traces e12 relatórios Lighthouse completos acessíveis.
- URL pública validada da revisão entregue, contratos e execução reproduzíveis desde checkout limpo.

## Auto-revisão do plano

Cobertura: cada D01–D26 aparece na tabela de dependências e em ao menos uma tarefa. Requisitos atualmente demonstrados permanecem no gate de regressão; os pendentes zoom/checkout limpo/deploy têm execução explícita nas tarefas11/13/14. Interfaces compartilhadas sessão/dinheiro/estoque/tentativa são produzidas antes de consumo; tarefas que editam o mesmo arquivo devem executar sequencialmente. Publicação permanece posterior à revisão concreta, conforme o escopo desta rodada.
