import { defineConfig } from "vitest/config";
import path from "node:path";

// Testes unitários da lógica crítica (matemática das ferramentas, etc.).
// Os e2e continuam no Playwright (`npm run test:e2e`).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
