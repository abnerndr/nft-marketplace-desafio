import { defineConfig } from "@playwright/test";

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Chromium nos dois viewports do desafio: 1440 (desktop) e 390 (mobile).
 * O app roda com o backend simulado (MSW) no navegador, então o único servidor é o `npm run dev`.
 * Cada teste abre com `?reset=1` (veja `e2e/fixtures.ts`) e controla relógio e latência por cenário
 * (`slow-network`, `order-timeout`, ...), sem `waitForTimeout`.
 */
export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002,
    },
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: "dark",
  },
  projects: [
    { name: "desktop-1440", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile-390",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "ignore",
  },
});
