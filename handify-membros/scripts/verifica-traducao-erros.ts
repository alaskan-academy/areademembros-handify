/**
 * Confere as traduções de erro de autenticação.
 *
 * Rodar com: npx tsx scripts/verifica-traducao-erros.ts
 *
 * As mensagens de entrada são as que o Supabase realmente devolve — a
 * primeira foi capturada em produção ao tentar cadastrar com "senha123".
 */
import { traduzErroAuth } from "../src/lib/auth/mensagens-erro";

const CASOS = [
  "Password is known to be weak and easy to guess, please choose a different one.",
  "Password should be at least 8 characters",
  "New password should be different from the old password.",
  "Invalid login credentials",
  "Email not confirmed",
  "User already registered",
  "Unable to validate email address: invalid format",
  "Token has expired or is invalid",
  "Email rate limit exceeded",
  "For security purposes, you can only request this after 60 seconds",
  "algo totalmente inesperado que ninguém previu",
];

let semTraducao = 0;

for (const bruto of CASOS) {
  const traduzido = traduzErroAuth(bruto);
  const temIngles = /[a-z]/.test(traduzido) && /password|email|token|invalid|user/i.test(traduzido);
  if (temIngles) semTraducao++;
  console.log(`${temIngles ? "✗" : "✓"} ${bruto}\n   → ${traduzido}\n`);
}

console.log(
  semTraducao === 0
    ? "Todas as mensagens saem em português."
    : `${semTraducao} mensagem(ns) ainda com inglês.`
);
