/**
 * O destino pós-login vem de um campo de formulário, ou seja, de fora. Se passar
 * endereço absoluto, o login vira trampolim: basta mandar para a aluna um
 * /login?redirect=https://site-falso e ela digita a senha na Handify e termina
 * noutro lugar, achando que continua aqui.
 *
 * O parâmetro existia desde sempre (proxy.ts:109 monta ?redirect=<caminho>) mas
 * era descartado — a aluna caía em /cursos. Quem abria o link da aula pelo
 * e-mail, deslogada, nunca chegava na aula.
 */
import { describe, it, expect } from "vitest";
import { destinoSeguro } from "@/lib/auth/destino-seguro";

describe("destinoSeguro", () => {
  it("leva ao caminho que ela tentou abrir", () => {
    expect(destinoSeguro("/aulas/74e14781-5963-43f0-b607-7efc66705534")).toBe(
      "/aulas/74e14781-5963-43f0-b607-7efc66705534"
    );
    expect(destinoSeguro("/comunidade/forum/velas-artesanais")).toBe(
      "/comunidade/forum/velas-artesanais"
    );
  });

  it("mantém query e âncora, que é como o botão do certificado funciona", () => {
    expect(destinoSeguro("/perfil#certificados")).toBe("/perfil#certificados");
    expect(destinoSeguro("/cursos?cat=velas")).toBe("/cursos?cat=velas");
  });

  it("cai em /cursos quando não veio destino", () => {
    expect(destinoSeguro(null)).toBe("/cursos");
    expect(destinoSeguro("")).toBe("/cursos");
  });

  it("recusa endereço absoluto", () => {
    expect(destinoSeguro("https://site-falso.com/entrar")).toBe("/cursos");
    expect(destinoSeguro("http://site-falso.com")).toBe("/cursos");
  });

  it("recusa protocol-relative, que o navegador lê como outro domínio", () => {
    expect(destinoSeguro("//site-falso.com")).toBe("/cursos");
    expect(destinoSeguro("//site-falso.com/aulas")).toBe("/cursos");
  });

  it("recusa a variante com barra invertida", () => {
    // Alguns navegadores normalizam "/\" para "//" e saem do domínio.
    expect(destinoSeguro("/\\site-falso.com")).toBe("/cursos");
  });

  it("não devolve a aluna para a tela de entrar", () => {
    expect(destinoSeguro("/login")).toBe("/cursos");
    expect(destinoSeguro("/login?redirect=/login")).toBe("/cursos");
    expect(destinoSeguro("/cadastro")).toBe("/cursos");
    expect(destinoSeguro("/nova-senha")).toBe("/cursos");
    expect(destinoSeguro("/auth/callback")).toBe("/cursos");
  });

  it("não confunde rota que apenas começa com o mesmo texto", () => {
    // "/cadastrados" não é "/cadastro"; só o caminho inteiro ou um filho contam.
    expect(destinoSeguro("/cadastrados")).toBe("/cadastrados");
  });

  it("recusa o que não é texto", () => {
    expect(destinoSeguro(new File([], "x") as unknown as FormDataEntryValue)).toBe("/cursos");
  });
});
