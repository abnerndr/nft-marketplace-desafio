import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "@/app/providers";
import { markMocksReady } from "@/mocks/ready";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@fontsource/roboto-mono/700.css";
import "./index.css";

// Sobe a UI na hora; o MSW termina em paralelo. As requests esperam `waitForMocks`.
if (import.meta.env.VITE_ENABLE_MOCKS !== "false") {
  void import("@/mocks/browser").then(({ enableMocks }) => enableMocks());
} else {
  markMocksReady();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
