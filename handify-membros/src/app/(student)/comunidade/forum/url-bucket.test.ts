import { describe, it, expect } from "vitest";

/**
 * Cópia da regra de urlDoNossoBucket para teste. A função vive num arquivo
 * "use server" e não pode ser importada aqui — se a regra mudar lá, muda aqui.
 * Existe porque a primeira versão dependia de env var e recusou TODA imagem em
 * produção, sem ninguém perceber até uma aluna reclamar.
 */
const CAMINHO = "/storage/v1/object/public/community/forum/";
function urlDoNossoBucket(valor: string, base?: string): boolean {
  let u: URL;
  try { u = new URL(valor); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (!u.hostname.endsWith(".supabase.co")) return false;
  if (!u.pathname.startsWith(CAMINHO)) return false;
  if (base) {
    try { if (new URL(base).hostname !== u.hostname) return false; } catch { /* ignora */ }
  }
  return true;
}

const VALIDA = "https://fjcdcvywdiagzovqqcpc.supabase.co/storage/v1/object/public/community/forum/abc/1.png";

describe("urlDoNossoBucket", () => {
  it("aceita a URL que o upload gera", () => {
    expect(urlDoNossoBucket(VALIDA)).toBe(true);
  });

  it("aceita mesmo sem a variável de ambiente — foi isso que quebrou em produção", () => {
    expect(urlDoNossoBucket(VALIDA, undefined)).toBe(true);
    expect(urlDoNossoBucket(VALIDA, "")).toBe(true);
  });

  it("aceita quando a variável bate com o host", () => {
    expect(urlDoNossoBucket(VALIDA, "https://fjcdcvywdiagzovqqcpc.supabase.co")).toBe(true);
  });

  it("recusa projeto diferente quando a variável diz qual é", () => {
    expect(urlDoNossoBucket(VALIDA, "https://outro.supabase.co")).toBe(false);
  });

  it("recusa site de fora", () => {
    expect(urlDoNossoBucket("https://site-malicioso.com/storage/v1/object/public/community/forum/x.png")).toBe(false);
  });

  it("recusa host que só termina parecido", () => {
    expect(urlDoNossoBucket("https://supabase.co.invasor.com/storage/v1/object/public/community/forum/x.png")).toBe(false);
  });

  it("recusa outro bucket ou outra pasta", () => {
    expect(urlDoNossoBucket("https://x.supabase.co/storage/v1/object/public/certificados/a.pdf")).toBe(false);
    expect(urlDoNossoBucket("https://x.supabase.co/storage/v1/object/public/community/inspiracoes/a.png")).toBe(false);
  });

  it("recusa http e texto que não é URL", () => {
    expect(urlDoNossoBucket("http://x.supabase.co/storage/v1/object/public/community/forum/a.png")).toBe(false);
    expect(urlDoNossoBucket("javascript:alert(1)")).toBe(false);
    expect(urlDoNossoBucket("")).toBe(false);
  });
});
