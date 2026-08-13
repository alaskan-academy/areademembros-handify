import { defineConfig, devices } from "@playwright/test";
import { resolve } from "path";
import { config as loadEnv } from "dotenv";

// Carrega .env.local para que as variáveis de ambiente fiquem disponíveis nos testes
loadEnv({ path: resolve(__dirname, ".env.local") });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // sequencial para evitar interferência de estado no banco
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "pt-BR",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Em CI, sobe o servidor; localmente assume que já está rodando
  webServer: process.env.CI
    ? {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
});
