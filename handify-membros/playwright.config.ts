import { defineConfig, devices } from "@playwright/test";
import { resolve } from "path";
import { config as loadEnv } from "dotenv";
import * as fs from "fs";

loadEnv({ path: resolve(__dirname, ".env.local") });

// Garante que o diretório de sessão existe
if (!fs.existsSync("e2e/.auth")) fs.mkdirSync("e2e/.auth", { recursive: true });

const SESSION_FILE = "e2e/.auth/session.json";
const hasSession = fs.existsSync(SESSION_FILE);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  timeout: 45_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    // Bloqueia Service Workers para evitar interferência do PWA nas navegações de teste
    serviceWorkers: "block",
    // Reutiliza sessão salva pelo global-setup (login único para todos os testes)
    storageState: hasSession ? SESSION_FILE : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
});
