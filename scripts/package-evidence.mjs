#!/usr/bin/env node
/**
 * Empacota manifesto da revisão (SHA, Node, ambiente) para o artefato de entrega.
 * Não falha se pastas de relatório estiverem ausentes — a CI sobe o que existir.
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
}

async function exists(rel) {
  try {
    await access(path.join(root, rel));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const outDir = path.join(root, "evidence");
  await mkdir(outDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    git: {
      sha: sh("git", ["rev-parse", "HEAD"]),
      short: sh("git", ["rev-parse", "--short", "HEAD"]),
      branch: sh("git", ["branch", "--show-current"]),
      status: sh("git", ["status", "--porcelain"]),
    },
    tools: {
      node: process.version,
      npm: sh("npm", ["--version"]),
    },
    env: {
      ci: Boolean(process.env.CI),
      platform: process.platform,
      arch: process.arch,
    },
    artifacts: {
      playwrightReport: await exists("playwright-report"),
      testResults: await exists("test-results"),
      lighthouseReports: await exists("reports/lighthouse"),
      lighthouseDocs: await exists("docs/lighthouse/results.md"),
    },
  };

  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Evidence manifest → evidence/manifest.json (sha ${manifest.git.short})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
