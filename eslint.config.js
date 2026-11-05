import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist",
    "public/mockServiceWorker.js",
    "evidence",
    ".worktrees/**",
    "playwright-report/**",
    "test-results/**",
    "reports/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // `use` dos fixtures do Playwright não é o hook `use` do React.
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // shadcn e rotas finas exportam helpers junto com componentes.
    files: ["src/components/ui/**/*.{ts,tsx}", "src/features/auth/auth-dialog.tsx", "src/app/router.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Recuperação de pedido / sync de galeria: setState no efeito é o padrão desejado aqui.
    files: ["src/features/checkout/payment-page.tsx", "src/features/nft/gallery.tsx"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);
