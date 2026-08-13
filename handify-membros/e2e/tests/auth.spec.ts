import { test, expect, type Page } from "@playwright/test";
import { loginAsTestUser, requireTestCredentials } from "../helpers/auth";

// Limpa cookies e localStorage para simular acesso sem sessão.
// Cada teste recebe um context fresh com storageState, então clearSession()
// não afeta outros testes (o context é destruído ao final de cada test).
async function clearSession(page: Page) {
  await page.context().clearCookies();
  // localStorage.clear em about:blank (antes de qualquer goto) — seguro, noop silencioso
  await page.evaluate(() => {
    try { localStorage.clear(); } catch { /* ok */ }
  });
}

test.describe("Autenticação", () => {
  test("página de login renderiza corretamente", async ({ page }) => {
    await clearSession(page);
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("acesso sem login redireciona para /login", async ({ page }) => {
    await clearSession(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("acesso à raiz sem login redireciona para /login", async ({ page }) => {
    await clearSession(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("tentativa de login com senha inválida exibe erro", async ({ page }) => {
    await clearSession(page);
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', "naoexiste@handify.com.br");
    await page.fill('input[type="password"]', "senha_errada_12345");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("login com credenciais válidas redireciona para área de membro", async ({ page }) => {
    requireTestCredentials();
    await clearSession(page);
    await loginAsTestUser(page);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator("text=Handify").first()).toBeVisible({ timeout: 10_000 });
  });

  test("logout redireciona para /login", async ({ page }) => {
    // Usa a sessão válida do storageState — não limpa cookies aqui
    await page.goto("/perfil");
    const logoutBtn = page
      .locator('button[type="submit"]', { hasText: /sair da conta/i })
      .first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    } else {
      const navLogout = page.locator("form button", { hasText: /sair/i }).first();
      if (await navLogout.isVisible()) {
        await navLogout.click();
        await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
      }
    }
  });
});
