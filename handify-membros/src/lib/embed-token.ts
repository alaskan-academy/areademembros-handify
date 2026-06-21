import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.EMBED_TOKEN_SECRET;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos por janela

function getSecret(): string {
  if (!SECRET) throw new Error("EMBED_TOKEN_SECRET não configurado");
  return SECRET;
}

/**
 * Gera um token assinado com expiração de ~15 min.
 * Formato: base64url(payload).signature
 * Onde payload = base64url({ email, w: window_15min })
 */
export function generateEmbedToken(email: string): string {
  const w = Math.floor(Date.now() / WINDOW_MS);
  const payload = Buffer.from(JSON.stringify({ email, w })).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Valida o token e retorna o email, ou null se inválido/expirado.
 * Aceita janela atual e anterior (até 30 min após geração).
 */
export function validateEmbedToken(token: string): { email: string } | null {
  try {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex < 0) return null;

    const payload = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);
    if (!payload || !sig) return null;

    // Verificar assinatura com comparação segura (evita timing attacks)
    const expectedSig = createHmac("sha256", getSecret())
      .update(payload)
      .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    // Verificar expiração (janela atual ou anterior)
    const { email, w } = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      email: string;
      w: number;
    };
    const currentWindow = Math.floor(Date.now() / WINDOW_MS);
    if (w < currentWindow - 1 || w > currentWindow) return null;
    if (!email || typeof email !== "string") return null;

    return { email };
  } catch {
    return null;
  }
}
