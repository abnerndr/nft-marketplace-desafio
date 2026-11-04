# Auditoria do escopo — Marketplace de NFTs

Data: 03/11/2026. Código analisado: `7e3d82d9d458fd3ce8583442e1881c3976c1581f`, branch `master`.

O escopo ainda tem lacunas funcionais, visuais e de entrega. As nove rotas existem e muitos fluxos normais funcionam, mas isso não demonstra atendimento integral. Esta auditoria não atribui nota nem aprovação da entrega.

## Fontes e método

- Escopo: [Desafio Frontend — Marketplace de NFTs.md](../Desafio%20Frontend%20%E2%80%94%20Marketplace%20de%20NFTs.md), encontrado no repositório. O caminho Windows informado não existe neste ambiente; não foi possível comparar os bytes com o arquivo de Downloads.
- Referência visual adotada por instrução do usuário: [Desafio NFT](https://www.figma.com/design/29GDGWiDm9YFc1IsHGrFby/Desafio-NFT?node-id=0-1). O Markdown contém outro file key; esta auditoria prioriza o link da conversa.
- MCP Figma: sessão `67244471-7c42-489e-af4e-bba60ff71d47`; metadata da página e `get_design_context` com screenshot para **todos os 15 frames**. A tentativa inicial de contexto da página retornou ausência de seleção; os frames foram identificados por metadata e consultados individualmente com sucesso.
- Revisões independentes por subagentes: compra; conta; tempo real, mocks e cobertura. Nenhum subagente alterou a implementação.
- Execução: tipos, lint, build, Vitest, Playwright completo e reprodução das quatro falhas visuais; inspeção adicional das nove telas no build de produção em 390, 414, 768 e 1440 px. 414 corresponde à largura dos frames mobile do Figma.
- Provas temporárias usam os handlers MSW reais e helpers da aplicação. As nove provas de compra **afirmam o comportamento defeituoso observado**: passarem reproduz o bug, não significa conformidade.
- Artefatos da execução ficam em `/tmp/nft-audit/`; são temporários e devem ser exportados para armazenamento durável na entrega. Plano de correções: [2026-11-03-nft-scope-gaps.md](superpowers/plans/2026-11-03-nft-scope-gaps.md).

Legenda: **observado** = teste/browser; **estático** = evidência de código; **risco** = mecanismo identificado com jornada completa ainda pendente. Não foi feito deploy nem alterado código funcional nesta etapa.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0; 1 warning no worker MSW gerado, sem erros |
| `npm run build` | Exit 0; bundle JS 1.202,67 kB / 397,52 kB gzip; warning de chunk grande |
| `npm test` | **134/134** testes, 21 arquivos |
| `npm run test:e2e -- --workers=2 --reporter=list,html` | **180 passaram, 4 falharam**, 184 execuções em Chromium desktop/mobile |
| Reexecução somente carrinho/pagamento visual | **4/4 falhas reproduzidas**, mesmos diffs |
| Provas temporárias de compra | **9/9** reproduções/invariantes observados com MSW real |
| Inspeção browser de 9 telas × 4 larguras | 36 capturas; nenhum `pageerror` ou imagem quebrada detectado nas capturas; perfil com overflow a 768 px |
| Provas browser adicionais | Estoque via Socket.IO, regressão de pedido terminal e overflow tablet reproduzidos **2/2**; 6 observações de bug, não testes de conformidade |
| Diagnóstico QueryClient de mutation antiga | Callback repõe perfil A depois de remover query e mudar sessão para B; sequência completa na UI pendente |

A primeira tentativa Playwright não iniciou o Vite porque a sandbox bloqueou `listen` com EPERM. Após execução autorizada fora da sandbox, a suíte completa rodou. O Chromium da inspeção também precisou dessa autorização. Não são falhas do produto.

Relatório HTML da suíte completa: `/tmp/nft-audit/playwright-report/index.html`. Traces e diffs da reprodução: `/tmp/nft-audit/visual-rerun/`. Baselines não foram atualizadas.

## Matriz do escopo

| Seção / requisito | Situação | Evidência / lacuna |
| --- | --- | --- |
| React, TypeScript, Router, Query, Axios, Tailwind | Uso efetivo observado | Rotas, queries/mutations, HTTP, CSS e build presentes |
| REST com MSW; Socket.IO client com binding MSW | Uso efetivo observado | Rede REST e WebSocket, sem substituir socket por setters |
| shadcn/ui efetivo | **Faltante** | Dependência, `components.json` e import CSS; nenhum componente shadcn/Radix usado em `src` (D01) |
| Playwright e Lighthouse | Presentes, resultados parciais | Suíte executável, oito PNGs versionados, script de 12 medições; falhas visuais e metas (D24–D25) |
| Início: destaques, catálogo e navegação | Parcial | Fluxos passam; assets, composição desktop e mobile divergem (D12–D13) |
| Busca/filtros combinados/ordenação/página na URL | Observado no fluxo normal | E2E em ambos tamanhos passa; refresh/histórico e parâmetros API presentes |
| Vazio, erro, retry e cancelamento de catálogo | Observado no fluxo normal | MSW e E2E; teste fora de ordem precisa esperar a resposta antiga terminar |
| Detalhe direto, 404, edição indisponível, limite individual | Observado no fluxo normal | E2E passa; modelo de estoque por edição incorreto após compras (D05) |
| Galeria | Parcial | Quatro miniaturas iguais e inertes; abrir imagem funciona (D21) |
| Favoritos autenticados/persistentes/otimista/rollback | Parcial | E2E passa; erro e recuperação sem feedback acessível (D19) |
| Carrinho: adicionar/alterar/remover/cupom/totais | Parcial | Fluxos normais passam; precisão, estoque, cotação e ajuste de quantidade (D04–D05, D16) |
| Carrinho após refresh/login | Parcial | Funciona normalmente; merge parcial perde itens (D15) |
| Preço/disponibilidade enquanto carrinho aberto | Parcial | Preço testado; disponibilidade REST/socket/edições divergente (D07) |
| ETH como strings e cálculo/apresentação precisos | **Não atendido integralmente** | Desconto `0.24` em vez de `0.238`; `0.00001` aparece `0 ETH` (D04) |
| Pagamento: campos do colecionador do layout | **Faltante** | Só há título, seleção e cadastro reduzido de carteira (D14) |
| Carteiras cadastradas/rede/conectar/recusar/desconectar | Observado no fluxo normal | E2E e API; formulário de carteira não substitui dados do colecionador |
| Revisão antes do envio / mudança de cotação | Parcial | Preflight existe; mobile esconde itens/taxas; revisão pode ser substituída pelo refetch (D14) |
| Clique repetido | Observado no fluxo normal | Ref sincrônica bloqueia dupla mutation; E2E passa |
| Idempotência servidor e retry mesmo corpo | Observado | Mesmo pedido recuperado; conflito com corpo diferente; E2E passa |
| Timeout + refresh + preço/carteira diferente | **Falha reproduzida nas camadas** | Tentativa original abandonada, duas compras (D03) |
| Pending/confirmed/declined e retomada por refresh | Parcial | Fluxo normal passa; estoque pendente, terminalidade, eventos e queda real incompletos (D06–D10) |
| Confirmação somente com confirmação da simulação | Parcial / risco eliminatório | Evento pode confirmar somente cache sem persistir pedido na simulação (D08) |
| Recibo snapshot / limpeza só do comprado / preservação em recusa | Observado nos cenários exercitados | Provas MSW de snapshot imutável e quantidade adicional preservada; não elimina D03/D06 |
| Cadastro/login/logout/refresh/rotas privadas | Observado no fluxo normal | E2E passa; 401/mutations tardios ainda comprometem troca (D02, D17) |
| Expiração durante checkout preserva contexto | Parcial | Interceptor e tentativa persistida; sem E2E da jornada no meio do pagamento; seleção/formulário não persistidos |
| Isolamento de dados/cache/subscriptions | Parcial / risco eliminatório | Cleanup socket existe; mutation de perfil antiga pode preencher cache global da conta nova (D02) |
| Perfil/avatar/senha com validação e persistência | Observado no fluxo normal | E2E passa; retry, skeletons e tablet parciais (D19, D22) |
| Carteiras principal/secundária e edição | Parcial | Núcleo funciona; extras salvos não podem ser consultados/editados (D20) |
| Contratos tipados e erros 400/401/404/409/422/5xx | Parcial | Zod nas respostas; cotação permissiva e ausência de cenário 403 explícito (D16, D18) |
| Loading/vazio/erro/sucesso/background refresh | Parcial | Catálogo/detalhe/carrinho presentes; conta/favoritos e skeleton do detalhe incompletos (D19, D25) |
| MSW: camada de rede, build configurável e seed variado | Observado | 36 NFTs, duas contas; worker ativo no build inspecionado |
| MSW: cenários determinísticos e reset integral | Parcial | Reset deixa storage/tentativas/timers; IDs sem comportamento próprio; relógio não controlado (D18, D24) |
| Eventos com identidade/versão e descarte de antigos | Parcial | NFT antigo/duplicado e outra conta cobertos; estado terminal aceita versão superior indevida (D09) |
| Reconciliação REST após reconexão real | Não demonstrada | Código de invalidação existe, mas não há controle de queda/reconexão no mock/E2E (D10) |
| Mudança simulada reflete em REST e evento | Parcial | Disponibilidade descartada; compra baixa estoque sem evento correspondente (D07–D08) |
| Fidelidade tipografia/cores/spacing/imagens/composição | Parcial | Identidade básica presente; comparativo de todos os frames abaixo (D12–D14, D20–D23) |
| Responsividade 390/768/1440 | Parcial | Inspeção executada; overflow perfil 768 e conteúdo promocional cortado (D22) |
| Skeleton shimmer + reduced motion | Parcial | CSS e E2E existem; conta não usa skeleton; detalhe não reserva altura real (D19, D25) |
| Teclado/foco/labels/erros/alt/live regions | Parcial | E2E básico passa; sem diálogo real/foco modal em auth/recibo, favoritos silenciosos (D19, D23) |
| Zoom sem perda de conteúdo | Pendente | Não foi concluída avaliação específica de zoom nesta rodada; incluir no plano |
| Assets e fontes locais, substituições documentadas | Parcial | Fontes/exports locais; NFTs principais continuam placeholders sem justificativa específica (D12) |
| E2E dos 12 grupos solicitados | Parcial | Principais fluxos passam; falta cobertura dos bugs encontrados e queda real/expiração durante checkout |
| Baselines estáveis/versionadas, HTML e traces | Parcial | Oito baselines; quatro obsoletas; HTML/traces locais ignorados no Git (D24, D26) |
| Lighthouse 3 medições × 2 páginas × 2 perfis | Presente; metas parciais | Nova execução registrada em evidências; ver tabela específica abaixo (D25) |
| Código/lockfile/config/assets/setup/docs | Presente; documentação parcial | README mock tem trechos desatualizados; artefatos não estão acessíveis no checkout (D26) |
| Deploy público obrigatório e igualdade com código | **Faltante / não verificado** | README declara nenhum deploy; sem URL pública para testar deep links/realtime (D11) |
| Checkout limpo sem serviços privados | Pendente de reprodução limpa | Build do workspace passou; `npm ci` em checkout limpo não foi executado |

## Achados para corrigir

P1 = regra central, risco de dados ou requisito obrigatório de alto impacto. P2 = cobertura/UX/robustez/qualidade parcial. Estático e risco não devem ser divulgados como se tivessem sido reproduzidos na interface.

| ID | Prioridade | Achado e evidência | Como demonstrar / limite |
| --- | --- | --- | --- |
| D01 | P1 | shadcn/ui só instalado/configurado. `rg` encontra apenas `src/index.css:3`; não há uso de componentes nem imports Radix em `src`. | Estático. Importar CSS não cumpre “Componentes: shadcn/ui” de uso efetivo; risco eliminatório. |
| D02 | P1 | `profileQueryKey=['profile']` e `useStoreProfile` escrevem qualquer resposta antiga sem validar dono; remoção de queries não cancela callbacks. `src/features/profile/api.ts:11`, `:28`. | Diagnóstico QueryClient confirma mecanismo A→B; reprodução completa SPA com resposta retida ainda pendente. Pode expor perfil A para B. |
| D03 | P1 | `usePlaceOrder` e `resolveOrderAttempt` substituem tentativa desconhecida ao mudar corpo/cotação. `src/features/orders/api.ts:69`, `src/features/orders/idempotency.ts:82`. | Prova MSW: timeout, preço 1.19→1.20, duas chaves, dois pedidos confirmados, estoque 5→3. Hook/UI completos não montados na prova. |
| D04 | P1 | Percentual usa `mulEth` que fixa casas da entrada; `formatEth` fixa quatro casas. `src/shared/domain/money.ts:22`, `:35`; `src/mocks/handlers/quote.ts:108`. | Reproduzido: 2.38×10%=0.24; correto 0.238. Total 2.16 em vez de 2.162. 0.00001 exibido 0 ETH. |
| D05 | P1 | Edições derivadas de um saldo único e linhas validadas separadamente. `src/mocks/handlers/nfts.ts:110`, `src/mocks/handlers/orders.ts:41`, `:143`. | Reproduzido: edição com 2 vende 1+2; duas edições vendem 5+5 com saldo agregado 5. |
| D06 | P1 | Pedido pendente confirma na segunda consulta sem reserva/revalidação. `src/mocks/handlers/orders.ts:190`. | Reproduzido: pending de 5, estoque agora zero, GETs confirmam compra. |
| D07 | P1 | `emitSocketEvent` descarta `available`; cliente não reconcilia `editions[]`/estoque da linha. `src/mocks/socket.ts:146`, `src/features/realtime/socket.ts:91`. | Browser 2/2: evento available=0 e preço1.20 recebido (novo preço visível), mas REST conserva saldo5/edições antigas e Comprar segue habilitado. Compra também não publica `nft.updated` de estoque. |
| D08 | P1 | `order.updated` manual não persiste transição no mock; UI aceita status no cache e para polling. `src/mocks/socket.ts:146`, `src/features/realtime/socket.ts:121`, `src/features/orders/api.ts:27`. | Estático e E2E existente injeta confirmação sem verificar REST. Confirmação pode discordar da simulação após refresh. |
| D09 | P1 | Ordem terminal só protegida por versão. Evento pending v3+ pode regredir confirmed/declined. `src/features/realtime/socket.ts:121`. | Browser 2/2: pedido confirmado voltou para “Aguardando confirmação” após pending v99; GET REST ainda confirmed. Teste entregue só usa versões1/2. |
| D10 | P1 | Queda/reconexão WebSocket ausente do mock e dos testes. `e2e/specs/10-eventos-pedido-pendente.spec.ts:97`. | O caso usa REST offline; não comprova desconexão real nem reconciliação Socket.IO. |
| D11 | P1 | URL pública/deploy ausentes. `README.md:103`. | `vercel.json` é configuração, não evidência de publicação. Sem produção verificada. |
| D12 | P1 | Fixtures apontam para `/nfts/*.svg` genéricos em vez das artes Figma disponíveis. `src/mocks/seed.ts:123`. | Observado em catálogo, galeria, carrinho, pagamento e recibo. Exports reais já existem em `src/assets/home`. |
| D13 | P1 | Shell mobile com header/nav desktop e footer extenso; faltam busca superior e bottom nav do Figma; cartões/composição diferentes. `src/app/shell.tsx:16`, `src/components/site-header.tsx:118`. | Observado em 390/414. Não basta empilhar desktop. Header desktop também sem margem superior/ativo Mercado; footer deve ocupar 1200px no frame, atual faixas na viewport inteira. |
| D14 | P1 | Checkout não implementa campos do colecionador e desktop difere estruturalmente; mobile só revisa total. `src/features/checkout/payment-page.tsx:546`, `:382`, `:416`. | Observado nas capturas. Revisão automática após refetch é risco a fechar com teste, sem afirmar falha reproduzida. |
| D15 | P2 | Merge apaga guest cart antes de enviar; após sucesso parcial, falha perde linhas restantes e login suprime erro. `src/features/cart/sync.ts:23`, `:60`, `src/features/auth/session.ts:83`. | Reproduzido: duas linhas, 1º POST ok e 2º 503; servidor só tem primeira e storage ficou vazio. |
| D16 | P2 | `/quote` ignora entradas inválidas e não valida edição/estoque/existência. `src/mocks/handlers/quote.ts:34`, `:84`. Stepper não consegue baixar 5→1 se servidor rejeita quantidade intermediária 4. | Prova: 500 unidades da edição esgotada + slug inexistente retornam 200. Stepper: estático, precisa caso de UI. |
| D17 | P2 | 401 de request com token A expira token B sem comparar sessão atual. `src/shared/api/client.ts:49`, `src/app/session-expiry.ts:12`. | Estático; adicionar resposta tardia A após login B. `fetchSession` também não consome AbortSignal. |
| D18 | P2 | Reset não limpa guest/cupom/tentativa/cache/timers; `validation-conflict` e `coupon-invalid` sem ação própria. `src/mocks/db.ts:65`, `src/mocks/socket.ts:88`. | Estático e README admite guest preservado. IDs sozinhos não reproduzem os erros. Não há cenário 403 explícito. |
| D19 | P2 | Favoritos omitem erro do hook; perfil/carteiras falham sem botão retry; loading da conta incompleto. `src/features/favorites/use-favorite.ts:74`, `src/features/profile/profile-page.tsx:308`, `src/features/wallets/wallets-page.tsx:437`. | Estático/E2E verifica rollback, não aviso. Erros precisam mensagem acessível e ação concreta. |
| D20 | P2 | Carteira salva alias/profileName/secondaryAddress/referralCode/email/ENS, mas edição só label/address/network. `src/features/wallets/wallets-page.tsx:134`, `src/features/wallets/types.ts:60`. | Estático comparado ao frame Carteiras: formulário visível precisa editar a carteira existente integralmente. |
| D21 | P2 | Galeria é quatro cópias sem seleção/estado/interação. `src/features/nft/detail-page.tsx:158`. | Estático e captura. Figma usa mesma arte em algumas miniaturas; problema funcional é serem inertes, não obrigação de inventar artes novas. |
| D22 | P2 | Perfil a 768px tem docWidth 815, Remover termina em x815; cards promocionais da home escondem texto/CTA a 768. `src/features/profile/profile-page.tsx:84`, `:200`, `src/features/catalog/home-page.tsx:430`. | Observado. Carrosséis com overflow próprio são intencionais e não foram classificados como defeito de viewport. |
| D23 | P2 | Auth desktop sem catálogo ao fundo; mobile sem composição/brand do frame; recibo não reproduz modal/overlay. `src/features/auth/auth-card.tsx:36`, `src/features/orders/confirmation-page.tsx:67`. | Observado. Falta semântica/gestão de foco se transformados em modal; não alegar foco modal atendido por teste de busca. |
| D24 | P2 | Quatro baselines obsoletas; lacunas E2E nos bugs, queda, disponibilidade, checkout expirado, edição carteira, terminalidade e relógio. `e2e/specs/13-visual.spec.ts:24`, `:37`. | Observado 2/2. Diff restrito ao header autenticado e deslocamentos locais: mudança funcional válida; atualizar baseline só após fechar Figma. |
| D25 | P2 | Performance e estabilidade de layout parciais; detalhe skeleton menor, bundle único ~1.2MB, quatro PNG ~1.9–2.1MB cada. `src/features/nft/detail-page.tsx`, `src/main.tsx`; relatórios Lighthouse. | Medições atuais em `/tmp/nft-audit/evidencias/lighthouse/`; separar custo real de variação de ambiente. |
| D26 | P2 | HTML/JSON completos e traces ignorados no Git, sem destino de entrega; documentação dos mocks desatualizada. `.gitignore:15`, `src/mocks/README.md:59`. | Estático: medianas versionadas não substituem relatórios completos. Links auxiliares levam ao diário e newsletter só preventDefault: comportamento precisa explicação de indisponibilidade, sem implementar páginas fora do escopo. |

## Comparação dos 15 frames pelo MCP

Dimensões dos frames desktop: 1440 px de largura; mobile: 414×896. Dados dinâmicos, conta autenticada, facetas, taxas e quantidades não precisam copiar números ilustrativos. As diferenças abaixo são de assets/composição/comportamento.

| Frame | Node | Resultado da comparação |
| --- | --- | --- |
| Desktop / Início | `1:661` | Estrutura básica presente; placeholders nos NFTs, fundo do hero muito mais evidente, cartões/footer e espaçamentos divergentes. |
| Desktop / Detalhes do NFT | `1:844` | Hierarquia geral presente; arte substituída, galeria inerte, header Mercado sem ativo e proporções de recomendações divergentes. |
| Desktop / Carrinho de NFTs | `1:994` | Tabela/resumo presentes; artes substituídas, header/footer e recomendações diferentes. Valores da API não são defeito visual. |
| Desktop / Pagamento | `1:1150` | Formulário do colecionador ausente; seleção/cadastro de carteiras ocupa seu lugar; resumo e header divergem. |
| Desktop / Confirmação de Pedido | `1:1153` | Conteúdo principal do recibo presente; sem modal/overlay da composição; artes substituídas. Rótulo de simulação é ajuste correto do enunciado. |
| Desktop / Login | `1:1248` | Card existe; falta página de marketplace sob ele e gestão modal correspondente. |
| Desktop / Cadastro | `1:1282` | Campos funcionam; mesmo desvio de composição do login. |
| Desktop / Perfil do Colecionador | `1:1316` | Formulário principal próximo em hierarquia; shell/footer e espaçamentos divergem. Conta autenticada no header é necessária. |
| Desktop / Carteiras | `1:1414` | Campos de criação semelhantes, mas editar carteira existente é reduzido e não preenche o formulário do frame; footer indevido nesta composição. |
| Mobile / Início | `1:1531` | Falta busca superior/botão filtro na mesma linha/bottom nav; header desktop, grade sem ritmo do frame e artes genéricas. |
| Mobile / Detalhes | `1:1629` | Barra inferior de compra presente; header desktop ocupa espaço, arte genérica, cartão/conteúdo deslocados. |
| Mobile / Carrinho | `1:1694` | Itens e resumo presentes; header extra e composição do resumo/ações não reproduzem frame; artes genéricas. |
| Mobile / Pagamento | `1:1785` | Cartões de carteiras existem; header desktop, formulário de cadastro sempre presente e confirmação fora da composição enxuta do frame. |
| Mobile / Login | `1:1907` | Formulário funcional; KURIO não centralizado com hierarquia/spacing de página própria, header/nav/footer extras. |
| Mobile / Cadastro | `1:1927` | Campos funcionais; header/nav/footer extras e tamanhos/spacing diferentes. |

Capturas locais por tela/largura: `/tmp/nft-audit/evidencias/<inicio|detalhe|carrinho|pagamento|confirmacao|login|cadastro|perfil|carteiras>-<390|414|768|1440>.png`.

## Lighthouse executado nesta auditoria

Build otimizado do HEAD auditado, mocks ativos, Chromium headless, Lighthouse 13.6.0, três execuções por combinação, sem suíte/browser concorrente. Relatórios completos (12 HTML + 12 JSON): `/tmp/nft-audit/evidencias/lighthouse/`. Ambiente Node 24.21.0 / Linux; comparar também a variação entre execuções.

| Página | Perfil | P | A | BP | SEO | LCP ms | CLS | TBT ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| / | mobile | 86 | 99 | 100 | 100 | 3377 | 0.0000 | 153 |
| / | desktop | 99 | 95 | 100 | 100 | 838 | 0.0002 | 0 |
| /nfts/emerald-ape-042 | mobile | 85 | 100 | 100 | 100 | 3591 | 0.1142 | 166 |
| /nfts/emerald-ape-042 | desktop | 89 | 100 | 100 | 100 | 774 | 0.2113 | 0 |

Performance abaixo de 90: início mobile (86), detalhe mobile (85), detalhe desktop (89). As outras categorias atingem as metas. O início mobile documentado anteriormente tinha 90; a nova mediana 86 evidencia margem insuficiente e variabilidade de ambiente, não prova por si só uma regressão de código. CLS do detalhe reproduz os números anteriores; bundle único e custo inicial dos mocks/imagens continuam presentes.

## Limites e próximos passos

- Riscos de cache/401 tardios exigem regressões com respostas retidas e troca SPA; não apresentar o diagnóstico isolado como uma exploração UI já concluída.
- Queda real Socket.IO, zoom e instalação em checkout limpo permanecem não demonstrados. A ausência da evidência é explicitada, não contada como teste aprovado.
- Publicação e verificação pública pertencem à etapa de ajuste/entrega; esta rodada não publica serviços.
- O plano vinculado prioriza uso efetivo da stack, privacidade, dinheiro/estoque/idempotência, consistência de eventos, Figma, acessibilidade, performance e evidências/deploy.

As correções devem usar `superpowers:subagent-driven-development`: uma tarefa por implementador, revisão de escopo e qualidade, e revisão final do conjunto. Esta rodada termina na auditoria e planejamento, conforme solicitado.
