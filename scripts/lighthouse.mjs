#!/usr/bin/env node
/**
 * Auditoria Lighthouse do build de produção (com os mocks ligados).
 *
 * Mede `/` e `/nfts/emerald-ape-042`, em mobile e desktop, três vezes cada, e grava a mediana.
 * Não remove imagem, fonte nem mock para subir a nota. Ficar abaixo da meta não derruba o script:
 * a mediana e a causa vão para `docs/lighthouse/REPORT.md`. O script só falha (exit 1) quando
 * não consegue medir (sem Chrome, build quebrado, Lighthouse com erro).
 *
 * Saídas:
 *   reports/lighthouse/<página>-<formato>-<n>.html|json   relatórios completos (ignorados pelo git)
 *   docs/lighthouse/results.json                          medianas e execuções
 *   docs/lighthouse/results.md                            tabela das medianas
 *
 * Variáveis: CHROME_PATH (Chrome a usar), LIGHTHOUSE_RUNS (padrão 3), LIGHTHOUSE_SKIP_BUILD=1.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4173;
const ORIGIN = `http://localhost:${PORT}`;
const RUNS = Number(process.env.LIGHTHOUSE_RUNS ?? 3);

const PAGES = [
  { id: "home", path: "/" },
  { id: "detalhe", path: "/nfts/emerald-ape-042" },
];
const FORM_FACTORS = ["mobile", "desktop"];

const TARGETS = { performance: 90, accessibility: 95, "best-practices": 95, seo: 90 };
const CATEGORIES = Object.keys(TARGETS);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} saiu com ${code}`))));
  });
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // servidor ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Servidor de preview não respondeu em ${url}`);
}

async function resolveChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  try {
    // O Chromium do Playwright serve quando não há Chrome instalado no sistema.
    const { chromium } = await import("@playwright/test");
    const bundled = chromium.executablePath();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    // sem Playwright: deixa o chrome-launcher procurar o Chrome do sistema
  }
  return undefined;
}

/** Versão do binário (`Google Chrome for Testing 156.0.8078.4`), nunca o caminho da sandbox. */
function readChromeVersion(chromePath) {
  const bin = chromePath ?? "google-chrome";
  try {
    return execFileSync(bin, ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return "desconhecida";
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function summarize(lhr) {
  const scores = Object.fromEntries(CATEGORIES.map((id) => [id, Math.round((lhr.categories[id]?.score ?? 0) * 100)]));
  return {
    scores,
    lcpMs: Math.round(lhr.audits["largest-contentful-paint"].numericValue),
    cls: Number(lhr.audits["cumulative-layout-shift"].numericValue.toFixed(4)),
    tbtMs: Math.round(lhr.audits["total-blocking-time"].numericValue),
    fcpMs: Math.round(lhr.audits["first-contentful-paint"].numericValue),
    failing: Object.values(lhr.audits)
      .filter((audit) => audit.score !== null && audit.score < 0.9 && audit.scoreDisplayMode !== "informative")
      .map((audit) => ({ id: audit.id, title: audit.title, score: audit.score })),
  };
}

async function measure(chrome, url, formFactor) {
  const flags = {
    port: chrome.port,
    output: ["html", "json"],
    onlyCategories: CATEGORIES,
    logLevel: "error",
  };
  const config = formFactor === "desktop" ? desktopConfig : undefined;
  const result = await lighthouse(url, flags, config);
  if (!result) throw new Error(`Lighthouse não devolveu resultado para ${url}`);
  if (result.lhr.runtimeError) throw new Error(`${result.lhr.runtimeError.code}: ${result.lhr.runtimeError.message}`);
  return result;
}

async function main() {
  if (process.env.LIGHTHOUSE_SKIP_BUILD !== "1") {
    // Build de demonstração: mocks ligados (VITE_ENABLE_MOCKS não é "false").
    await run("npm", ["run", "build"]);
  }

  const reportsDir = path.join(root, "reports", "lighthouse");
  const docsDir = path.join(root, "docs", "lighthouse");
  await mkdir(reportsDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });

  const preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: root,
    stdio: "ignore",
  });
  let chrome;
  let profileDir;
  try {
    await waitForServer(ORIGIN);

    const chromePath = await resolveChrome();
    // WSL: chrome-launcher trata `userDataDir: false` como falsy e cai em mkdtemp no AppData do Windows
    // (EACCES). Passar um diretório Linux explícito evita isso.
    profileDir = await mkdtemp(path.join(os.tmpdir(), "kurio-lighthouse-"));
    chrome = await launch({
      chromePath,
      userDataDir: profileDir,
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });

    const results = [];
    for (const page of PAGES) {
      for (const formFactor of FORM_FACTORS) {
        const runs = [];
        for (let n = 1; n <= RUNS; n += 1) {
          const result = await measure(chrome, `${ORIGIN}${page.path}`, formFactor);
          const [html, json] = result.report;
          const base = path.join(reportsDir, `${page.id}-${formFactor}-${n}`);
          await writeFile(`${base}.html`, html);
          await writeFile(`${base}.json`, json);
          const summary = summarize(result.lhr);
          runs.push(summary);
          console.log(
            `${page.id} ${formFactor} #${n}: ` +
              CATEGORIES.map((id) => `${id}=${summary.scores[id]}`).join(" ") +
              ` LCP=${summary.lcpMs}ms CLS=${summary.cls} TBT=${summary.tbtMs}ms`,
          );
        }
        const medianOf = (pick) => median(runs.map(pick));
        const scores = Object.fromEntries(CATEGORIES.map((id) => [id, medianOf((run) => run.scores[id])]));
        results.push({
          page: page.path,
          formFactor,
          runs,
          median: {
            scores,
            lcpMs: medianOf((run) => run.lcpMs),
            cls: medianOf((run) => run.cls),
            tbtMs: medianOf((run) => run.tbtMs),
            fcpMs: medianOf((run) => run.fcpMs),
          },
          meetsTargets: CATEGORIES.every((id) => scores[id] >= TARGETS[id]),
        });
      }
    }

    const lighthouseVersion = (await import("lighthouse/package.json", { with: { type: "json" } })).default.version;
    const payload = {
      generatedAt: new Date().toISOString(),
      lighthouse: lighthouseVersion,
      chrome: readChromeVersion(chromePath),
      runsPerPage: RUNS,
      targets: TARGETS,
      results,
    };
    await writeFile(path.join(docsDir, "results.json"), `${JSON.stringify(payload, null, 2)}\n`);
    await writeFile(path.join(docsDir, "results.md"), renderTable(payload));
    console.log(`\nRelatórios completos em reports/lighthouse/. Medianas em docs/lighthouse/results.md`);
  } finally {
    if (chrome) await chrome.kill();
    if (profileDir) await rm(profileDir, { recursive: true, force: true });
    preview.kill("SIGTERM");
  }
}

function renderTable(payload) {
  const header =
    "| Página | Formato | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) | Metas |\n" +
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";
  const rows = payload.results
    .map(({ page, formFactor, median: m, meetsTargets }) =>
      [
        `\`${page}\``,
        formFactor,
        m.scores.performance,
        m.scores.accessibility,
        m.scores["best-practices"],
        m.scores.seo,
        m.lcpMs,
        m.cls,
        m.tbtMs,
        meetsTargets ? "ok" : "abaixo",
      ].join(" | "),
    )
    .map((row) => `| ${row} |`)
    .join("\n");
  return (
    `# Medianas Lighthouse\n\nLighthouse ${payload.lighthouse}, ${payload.runsPerPage} medições por página e formato. ` +
    `Gerado por \`npm run lighthouse\` em ${payload.generatedAt}.\n\n${header}${rows}\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
