# Relatório Lighthouse

Gerado por `npm run lighthouse` (`scripts/lighthouse.mjs`). O script faz `npm run build`, sobe `vite preview`
em `http://localhost:4173` e mede, com Lighthouse 13.6.0 e o Chromium do Playwright em modo headless:

- páginas: `/` e `/nfts/emerald-ape-042`;
- formatos: mobile (emulação e throttling padrão do Lighthouse) e desktop (`desktop-config`);
- três medições por página e formato; vale a **mediana** de cada número.

O build é o de demonstração, com os mocks ligados. Nenhuma imagem, fonte ou mock foi removido para subir nota.
O script não falha se uma mediana ficar abaixo da meta; só falha se não conseguir medir. Os HTML e JSON completos
vão para `reports/lighthouse/` (ignorado pelo git). As medianas ficam em `results.json` e `results.md`, nesta
pasta.

Metas do enunciado: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

## Resultado (medianas de 3 execuções)

| Página | Formato | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | Metas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | mobile | **90** | 100 | 100 | 100 | 3025 ms | 0 | 243 ms | atingidas |
| `/` | desktop | 100 | 100 | 100 | 100 | 644 ms | 0,0002 | 0 ms | atingidas |
| `/nfts/emerald-ape-042` | mobile | **84** | 100 | 100 | 100 | 3989 ms | **0** | 207 ms | Performance abaixo |
| `/nfts/emerald-ape-042` | desktop | **99** | 100 | 100 | 100 | 863 ms | **0** | 0 ms | atingidas |

Performance por execução: `/` mobile 89/90/91, `/` desktop 100/100/100, detalhe mobile 85/84/84, detalhe desktop
99/99/99. Máquina: WSL2 no Linux; os números variam alguns pontos entre execuções, sobretudo no mobile.

Accessibility, Best Practices e SEO atingem 100 nas quatro combinações. Performance fecha em `/` (mobile no
limite, desktop com folga) e no detalhe desktop; **não fecha no detalhe mobile** (LCP ~4 s sob throttling + MSW).

## Alterações feitas por causa da auditoria

### CLS do detalhe (era 0,11 / 0,21)

O esqueleto do detalhe reservava ~450 px; o conteúdo real passa de 1600 px e empurrava o rodapé. `DetailSkeleton`
agora espelha galeria, bloco de info, descrição e recomendações com `min-height` compatível. **CLS do detalhe
foi a 0** nos dois formatos.

### Bundle e first paint

- Rotas de checkout, carrinho, conta, pedidos e auth carregam sob `React.lazy` + `Suspense`.
- MSW sobe em paralelo ao primeiro render (`import()` dinâmico); requests HTTP e Socket.IO esperam
  `waitForMocks()` para não falar com a rede real antes do worker.
- PNGs do hero/promo redimensionados (~600–900 px) com originais em `src/assets/home/original/`.
- Heading do catálogo (`h2` sr-only) e alvos dos sliders de preço (≥24 px) corrigidos para a11y.

### Ambiente WSL

`scripts/lighthouse.mjs` passa `userDataDir` Linux explícito ao chrome-launcher (evita `EACCES` em
`/mnt/c/Users/.../AppData`).

## Causas do que ficou abaixo

### Detalhe mobile: Performance 84 (LCP ~4 s)

O LCP do detalhe só fecha depois do JS + worker MSW + `GET /api/nfts/:slug`. Com throttling mobile do
Lighthouse isso fica ~4 s. Tentativas de antecipar LCP com poster no skeleton pioraram a nota (PNG grande
vira o LCP). Desligar mocks na auditoria é proibido pelo plano. O detalhe **desktop** sobe de 89 → 99
graças ao CLS zerado e ao split de rotas.

### `/` mobile: LCP ~3 s, Performance 90

No limite da meta. O custo dominante continua sendo o bundle de demonstração com MSW; o paint antecipado
(UI antes do worker) recupera a mediana para ≥90.

### Causas comuns

- `unused-javascript`: MSW + Socket.IO no chunk dinâmico de mocks (~700 KB) — necessário na demo.
- `render-blocking-insight` / fontes Roboto Mono.
- `valid-source-maps`: build de produção sem source maps (não afeta nota de categoria).

## Como reproduzir

```bash
npm run lighthouse
# ou, com dist já gerado:
LIGHTHOUSE_SKIP_BUILD=1 npm run lighthouse
```

Relatórios HTML/JSON: `reports/lighthouse/`. Medianas: `docs/lighthouse/results.md`.
