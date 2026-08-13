import { chromium, type FullConfig } from "@playwright/test";

/**
 * Faz login uma única vez e salva o estado da sessão em .auth/session.json.
 * Todos os testes reutilizam essa sessão — evita múltiplos logins e rate limit.
 */
export default async function globalSetup(config: FullConfig) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    console.warn("[global-setup] TEST_EMAIL/TEST_PASSWORD não definidos — testes de login serão pulados");
    return;
  }

  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });

  // Salva cookies + localStorage em arquivo — reutilizado em todos os testes
  await page.context().storageState({ path: "e2e/.auth/session.json" });
  await browser.close();

  console.log("[global-setup] Sessão salva em e2e/.auth/session.json");
}
