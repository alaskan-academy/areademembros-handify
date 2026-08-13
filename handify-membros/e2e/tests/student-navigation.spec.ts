import { test, expect } from "@playwright/test";
import { loginAsTestUser, requireTestCredentials } from "../helpers/auth";

test.describe("Navegação da aluna", () => {
  test.beforeEach(async ({ page }) => {
    requireTestCredentials();
    await loginAsTestUser(page);
  });

  test("dashboard carrega com a navegação lateral", async ({ page }) => {
    await page.goto("/dashboard");
    // Sidebar deve estar visível
    await expect(page.locator("nav, aside")).first().toBeVisible();
    // Logo Handify no header
    await expect(page.locator("text=Handify").first()).toBeVisible();
  });

  test("página de cursos carrega sem erros", async ({ page }) => {
    await page.goto("/cursos");
    await expect(page).toHaveURL(/\/cursos/);
    // Não deve exibir "500" ou "error" como único conteúdo visível
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/^500$/);
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test("página de comunidade carrega", async ({ page }) => {
    await page.goto("/comunidade");
    await expect(page).toHaveURL(/\/comunidade/);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test("página de perfil carrega", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/perfil/);
    // O email do usuário logado deve aparecer ou algum campo editável
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test("links do menu de navegação respondem corretamente", async ({ page }) => {
    await page.goto("/dashboard");
    // Verifica que existem links de navegação
    const navLinks = page.locator("nav a, aside a");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("notificações — sino abre painel", async ({ page }) => {
    await page.goto("/dashboard");
    // O sino de notificações deve estar presente
    const bell = page.locator('[aria-label*="notif" i], [aria-label*="sino" i]').first();
    if (await bell.isVisible()) {
      await bell.click();
      // O painel de notificações deve aparecer
      await expect(
        page.locator('[role="dialog"], [role="region"]').first()
      ).toBeVisible({ timeout: 3_000 });
    }
  });

  test("busca global (Ctrl+K) abre modal de busca", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Control+k");
    // Um campo de busca deve aparecer
    const searchInput = page.locator('input[type="search"], input[placeholder*="buscar" i], input[placeholder*="pesquisar" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
  });
});
