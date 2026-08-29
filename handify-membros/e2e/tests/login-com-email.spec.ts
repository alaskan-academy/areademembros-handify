import { test, expect, type Page } from "@playwright/test";

/**
 * Link direto de login com e-mail embutido: `/login/aluna@email.com`.
 * Enviado por WhatsApp para a aluna cair na tela certa sem digitar nada.
 */

// E-mail que sabidamente NÃO tem conta — nunca usar aluna real aqui.
const EMAIL_SEM_CONTA = "sem-conta-e2e@handify-teste.com";

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* ok */
    }
  });
}

test.describe("Link de login com e-mail", () => {
  test("logada: vai para os cursos", async ({ page }) => {
    await page.goto(`/login/${encodeURIComponent(EMAIL_SEM_CONTA)}`);
    await expect(page).toHaveURL(/\/cursos/, { timeout: 20_000 });
  });

  test("deslogada e sem conta: vai para o cadastro com o e-mail", async ({ page }) => {
    await clearSession(page);
    await page.goto(`/login/${encodeURIComponent(EMAIL_SEM_CONTA)}`);
    await page.waitForURL(/\/cadastro\//, { timeout: 20_000 });
    expect(decodeURIComponent(new URL(page.url()).pathname)).toBe(`/cadastro/${EMAIL_SEM_CONTA}`);
  });

  test("deslogada e com conta: login com o e-mail preenchido", async ({ page }) => {
    const email = process.env.TEST_EMAIL;
    if (!email) {
      test.skip(true, "TEST_EMAIL não configurado");
      return;
    }

    await clearSession(page);
    await page.goto(`/login/${encodeURIComponent(email)}`);
    await expect(page).toHaveURL(/\/login\?email=/, { timeout: 20_000 });
    await expect(page.locator('input[type="email"]')).toHaveValue(email);
  });

  test("e-mail inválido no link: cai no login normal, sem 404", async ({ page }) => {
    await clearSession(page);
    const response = await page.goto("/login/isso-nao-e-um-email");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
  });
});
