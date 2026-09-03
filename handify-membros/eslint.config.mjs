import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker gerado pelo next-pwa a cada build. Era responsável por 93
    // dos avisos do lint — ruído que escondia os problemas reais do src/.
    "public/sw.js",
    "public/workbox-*.js",
    "public/worker-*.js",
    "public/fallback-*.js",
  ]),
  {
    rules: {
      // O projeto já usa `_` para marcar o que existe só para satisfazer uma
      // assinatura (ex: `_formData` numa Server Action que ignora o form).
      // Sem isso, a regra acusa justamente o que foi deliberado.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
