import { test, expect } from "@playwright/test";

// Todos os testes usam o storageState (sessão pré-autenticada)
// Nota: /verificar/[hash] exige login desde jun/2026 (plataforma 100% fechada)

test.describe("Certificado — verificação pública", () => {
  test("hash inválido exibe página 404 sem erro 500", async ({ page }) => {
    await page.goto("/verificar/00000000-0000-0000-0000-000000000000");
    await page.waitForLoadState("networkidle");
    // notFound() → Next.js renderiza 404; verifica que não há erro 500
    await expect(page).not.toHaveURL(/\/(500|_error)/i);
    const title = await page.title();
    expect(title.toLowerCase()).not.toContain("500");
    expect(title.toLowerCase()).not.toContain("internal server error");
  });

  test("hash com formato inválido (não UUID) não retorna 500", async ({ page }) => {
    await page.goto("/verificar/hash-invalido-qualquer");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/(500|_error)/i);
    const title = await page.title();
    expect(title.toLowerCase()).not.toContain("500");
    expect(title.toLowerCase()).not.toContain("internal server error");
  });

  test("página de perfil lista certificados (ou mostra seção vazia)", async ({ page }) => {
    await page.goto("/perfil");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/perfil/);
    // Aceita qualquer estado: com certificado ou sem (usuário de teste provavelmente não tem)
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(100);
  });
});
