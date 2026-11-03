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
| `/` | mobile | **90** | 99 | 100 | 100 | 3331 ms | 0 | 182 ms | atingidas |
| `/` | desktop | 99 | 95 | 100 | 100 | 829 ms | 0,0002 | 0 ms | atingidas |
| `/nfts/emerald-ape-042` | mobile | **84** | 100 | 100 | 100 | 3581 ms | **0,1142** | 173 ms | Performance abaixo |
| `/nfts/emerald-ape-042` | desktop | **89** | 100 | 100 | 100 | 766 ms | **0,2113** | 0 ms | Performance abaixo |

Performance por execução: `/` mobile 91/90/88, `/` desktop 99/99/99, detalhe mobile 85/84/83, detalhe desktop
89/89/89. Máquina: WSL2 no Linux; os números variam alguns pontos entre execuções, sobretudo no mobile.

Accessibility, Best Practices e SEO atingem a meta nas quatro combinações. Performance fecha em `/` (desktop com
folga, mobile no limite) e **não fecha no detalhe**, nos dois formatos.

## Alterações feitas por causa da auditoria

A primeira execução teve SEO 83 em todas as páginas, abaixo da meta de 90. Duas causas reais, corrigidas sem mexer em imagem, fonte ou mock:

- `meta-description` ausente: `index.html` ganhou `<meta name="description">` e um título descritivo.
- `robots-txt` inválido: sem arquivo, o fallback de SPA devolvia `index.html` para `/robots.txt` e o Lighthouse
  contava 14 erros. `public/robots.txt` (`User-agent: *`, `Allow: /`) resolve.

SEO foi de 83 para 100. As demais notas não mudaram.

## Causas do que ficou abaixo

### Detalhe: CLS 0,11 (mobile) e 0,21 (desktop)

O deslocamento é do `<footer>`. O esqueleto do detalhe (`DetailSkeleton` em `features/nft/detail-page.tsx`) tem
cerca de 450 px de altura (`h-[448px]` no desktop); quando a query resolve, o conteúdo real passa de 1600 px e empurra o rodapé para
baixo. O Lighthouse aponta `1 layout shift found` com o rodapé como elemento deslocado. A correção é reservar a
altura do conteúdo no esqueleto (`min-height` ou um esqueleto com as mesmas seções). Não foi feita nesta task:
mexe em layout da tela e merece revisão visual própria.

Uma tentativa de fixar o tamanho das imagens das estrelas (`<img>` de data URI sem `width` e `height`) foi
descartada: o CLS não mudou, então não era a causa.

### Detalhe: LCP 3,6 s no mobile

Divisão do LCP: tempo até o primeiro byte de 2,6 ms e atraso de renderização de 312 ms; o resto é o que vem antes:
baixar e executar o JavaScript, subir o worker do MSW e buscar o detalhe. O elemento de LCP é um parágrafo de
texto, não imagem. Isso, somado ao CLS, deixa a Performance do detalhe em 84 no mobile e 89 no desktop.

### `/` mobile: LCP 3,3 s e Performance 90

No limite da meta. O elemento de LCP é uma imagem SVG inline (data URI) do hero, e o atraso é de
renderização (255 ms): a página só monta depois do JavaScript e do worker.

### Causas comuns às quatro medições

- `unused-javascript`: economia estimada de 180 KiB. O app é um bundle único (`index-*.js`, ~1,2 MB, 395 KB
  gzip) sem divisão por rota, e inclui `msw` e `socket.io-client`.
- `render-blocking-insight`: ~150 ms em mobile.
- `valid-source-maps`: o build de produção não publica source maps. Não afeta nota de categoria.
- `main.tsx` faz `await enableMocks()` antes do primeiro render. É o custo do build de demonstração com mocks
  ligados: com `VITE_ENABLE_MOCKS=false` o app renderiza sem esperar o worker.
- As imagens decorativas do hero e das seções (`hero-art.png`, `art-*.png`, ~1,9 a 2,1 MB cada) são pesadas.
  Foram mantidas (são do Figma); não entram nas medianas como LCP, mas pesam no total transferido.

### Accessibility, abaixo de 100

- `heading-order` em `/` (um `h3` sem `h2` antes) e, no desktop, `target-size` nos dois sliders de preço do
  filtro (`input type=range`). As duas falhas deixam `/` em 99 (mobile) e 95 (desktop): acima da meta, mas sem
  folga no desktop.

## Próximos passos sugeridos

1. Dar ao esqueleto do detalhe a altura do conteúdo real (corrige o CLS e sobe a Performance do detalhe).
2. Dividir o bundle por rota (`React.lazy` nas telas de checkout, conta e pedidos) e carregar o `msw` só com os
   mocks ligados.
3. Converter ou redimensionar os PNGs do hero sem tirá-los da página.
4. Ajustar a hierarquia de títulos do catálogo e o alvo dos sliders.

## Como reproduzir

```bash
npm run lighthouse                          # build + 4 combinações x 3 medições
LIGHTHOUSE_SKIP_BUILD=1 npm run lighthouse  # reaproveita dist/
LIGHTHOUSE_RUNS=5 npm run lighthouse        # mais medições
CHROME_PATH=/caminho/do/chrome npm run lighthouse
```

Sem `CHROME_PATH`, o script usa o Chromium do Playwright (`npx playwright install chromium`) e, na falta dele,
deixa o `chrome-launcher` procurar um Chrome instalado.
