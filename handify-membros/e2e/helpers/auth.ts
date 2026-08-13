import { type Page } from "@playwright/test";

export const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

/**
 * Faz login explicitamente na página (usado apenas em testes de auth que precisam
 * testar o próprio fluxo de login). Testes gerais usam o storageState do global-setup.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });
}

export function requireTestCredentials(): void {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("TEST_EMAIL e TEST_PASSWORD devem estar definidos em .env.local");
  }
}
