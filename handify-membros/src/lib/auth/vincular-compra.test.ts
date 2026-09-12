import { describe, it, expect } from "vitest";
import { telefoneComparavel, telefoneUtilizavel, mesmoPrimeiroNome } from "./vincular-compra";

describe("telefoneComparavel", () => {
  it("mantém o celular brasileiro de 11 dígitos", () => {
    expect(telefoneComparavel("81999205815")).toBe("81999205815");
  });

  it("tira o 55 de país", () => {
    // Caso real: medileuzasantosnascimento — o perfil tinha "+5585992201055" e a
    // compra tinha "85992201055". Sem normalizar, o cruzamento não achava.
    expect(telefoneComparavel("+5585992201055")).toBe("85992201055");
    expect(telefoneComparavel("5585992201055")).toBe("85992201055");
  });

  it("tira máscara e espaço", () => {
    expect(telefoneComparavel("(81) 99920-5815")).toBe("81999205815");
  });

  it("NÃO confunde DDD 55 com código de país", () => {
    // Santa Maria/RS: 11 dígitos começando com 55 é DDD, não país.
    expect(telefoneComparavel("55999205815")).toBe("55999205815");
  });

  it("devolve null para vazio", () => {
    expect(telefoneComparavel("")).toBeNull();
    expect(telefoneComparavel(null)).toBeNull();
    expect(telefoneComparavel("---")).toBeNull();
  });
});

describe("telefoneUtilizavel", () => {
  it("exige DDD + número", () => {
    expect(telefoneUtilizavel("81999205815")).toBe(true);
    expect(telefoneUtilizavel("9920581")).toBe(false);
    expect(telefoneUtilizavel(null)).toBe(false);
  });
});

describe("mesmoPrimeiroNome", () => {
  it("liga a aluna que errou o próprio e-mail", () => {
    // Germana: 10/09/2026, cadastro com um "n" a mais no e-mail.
    expect(
      mesmoPrimeiroNome("Germana Almeida Padilha de Oliveira", "Germana Almeida Padilha de Oliveira")
    ).toBe(true);
    // Vilma: comprou escrevendo "hormail.com".
    expect(mesmoPrimeiroNome("Vilma Marques de melo", "Vilma Marques de melo")).toBe(true);
  });

  it("aceita nome abreviado depois do primeiro", () => {
    // Ana Tonetti: compra "Ana Maria Tonetti Costa", conta "Ana Maria tonetti".
    expect(mesmoPrimeiroNome("Ana Maria Tonetti Costa", "Ana Maria tonetti")).toBe(true);
  });

  it("ignora acento e caixa", () => {
    expect(mesmoPrimeiroNome("JOSÉ da Silva", "josé Carlos")).toBe(true);
    expect(mesmoPrimeiroNome("Mônica Alves", "MONICA souza")).toBe(true);
  });

  it("RECUSA duas pessoas no mesmo telefone", () => {
    // Caso real hzpdp@gmail.com (Hemerson) × hzpdp1969@gmail.com (Hida): mesmo
    // telefone, mesmo sobrenome, pessoas diferentes. Se a regra fosse só o
    // telefone, os 6 cursos dele iriam para a conta dela.
    expect(mesmoPrimeiroNome("Hemerson Hales Ponce", "Hida Zuleide pereira Duarte ponce")).toBe(
      false
    );
  });

  it("não decide com nome vazio ou de uma letra", () => {
    expect(mesmoPrimeiroNome("", "Ana")).toBe(false);
    expect(mesmoPrimeiroNome(null, "Ana")).toBe(false);
    expect(mesmoPrimeiroNome("A Silva", "A Souza")).toBe(false);
  });

  it("não casa nomes diferentes que começam igual", () => {
    expect(mesmoPrimeiroNome("Ana Paula", "Anabela Costa")).toBe(false);
    expect(mesmoPrimeiroNome("Mari Souza", "Maria Souza")).toBe(false);
  });
});
