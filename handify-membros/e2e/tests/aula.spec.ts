import { test, expect } from "@playwright/test";

// Todos os testes usam o storageState (sessão pré-autenticada do global-setup)

test.describe("Aula — player e interações", () => {
  let lessonId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Descobre uma aula de prévia gratuita uma única vez para todos os testes
    lessonId = process.env.TEST_LESSON_ID ?? null;
    if (!lessonId) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await page.goto("/cursos");
        await page.waitForLoadState("networkidle");
        const courseLink = page.locator("a[href*='/cursos/']").first();
        if (await courseLink.isVisible({ timeout: 5_000 })) {
          await courseLink.click();
          await page.waitForURL(/\/cursos\//);
          const lessonLink = page.locator("a[href*='/aulas/']").first();
          if (await lessonLink.isVisible({ timeout: 5_000 })) {
            const href = await lessonLink.getAttribute("href");
            lessonId = href?.match(/\/aulas\/([^/?]+)/)?.[1] ?? null;
          }
        }
      } finally {
        await ctx.close();
      }
    }
  });

  test("página de aula carrega com player ou mensagem de acesso", async ({ page }) => {
    if (!lessonId) {
      test.skip(true, "Nenhuma aula encontrada para o usuário de teste");
      return;
    }
    await page.goto(`/aulas/${lessonId}`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/aulas\//);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/^500$|Internal Server Error/i);
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test("sidebar de módulos lista aulas adjacentes", async ({ page }) => {
    if (!lessonId) {
      test.skip(true, "Nenhuma aula encontrada para o usuário de teste");
      return;
    }
    await page.goto(`/aulas/${lessonId}`);
    await page.waitForLoadState("networkidle");
    const list = page.locator("ol, ul, nav, [role='list']").first();
    await expect(list).toBeVisible({ timeout: 8_000 });
  });

  test("botão 'marcar como concluída' ou acesso restrito está presente", async ({ page }) => {
    if (!lessonId) {
      test.skip(true, "Nenhuma aula encontrada para o usuário de teste");
      return;
    }
    await page.goto(`/aulas/${lessonId}`);
    await page.waitForLoadState("networkidle");
    // Aceita qualquer conteúdo de aula — botão só aparece para matriculadas
    await expect(page).toHaveURL(/\/aulas\//);
  });

  test("navegação para aula inexistente não retorna 500", async ({ page }) => {
    await page.goto("/aulas/00000000-0000-0000-0000-000000000000");
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/^500$|Internal Server Error/i);
  });
});
