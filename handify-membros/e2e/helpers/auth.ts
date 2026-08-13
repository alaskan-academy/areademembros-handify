import { type Page } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

/** Faz login com as credenciais de teste e aguarda o redirecionamento para o dashboard. */
export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  // Aguarda navegação para fora do /login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
}

/** Garante que o usuário de teste está configurado nas variáveis de ambiente. */
export function requireTestCredentials(): void {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      "TEST_EMAIL e TEST_PASSWORD devem estar definidos em .env.local para rodar os testes E2E"
    );
  }
}
