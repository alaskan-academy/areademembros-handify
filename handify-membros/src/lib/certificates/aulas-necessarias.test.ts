/**
 * A regra que decide quem recebe o certificado.
 *
 * O limiar era 0,95 e, com arredondamento para cima, virava "todas as aulas" nos
 * cursos curtos: 19 aulas pediam 19, 9 pediam 9. A aluna chegava na última aula,
 * lia "Parabéns! Você concluiu o curso" e não tinha certificado nenhum.
 *
 * Com 0,90 isso melhora nos cursos médios e grandes, MAS o arredondamento
 * continua engolindo a folga em curso pequeno. Os casos abaixo fixam isso por
 * escrito: se alguém mexer no limiar achando que 90% sempre perdoa uma aula, o
 * teste mostra onde não perdoa.
 */
import { describe, it, expect, vi } from "vitest";

// `issue.ts` é módulo de servidor; o import de `server-only` não resolve no
// vitest, e o resto do arquivo (Supabase, PDF, e-mail) nem chega a ser usado aqui.
vi.mock("server-only", () => ({}));

const { aulasNecessarias } = await import("./issue");

describe("aulasNecessarias", () => {
  it("perdoa aulas nos cursos de verdade da plataforma", () => {
    expect(aulasNecessarias(30)).toBe(27); // Saponaria Brasil: perdoa 3
    expect(aulasNecessarias(19)).toBe(18); // Fábrica de Lembrancinhas: perdoa 1
    expect(aulasNecessarias(45)).toBe(41); // Velaroma: perdoa 4
    expect(aulasNecessarias(33)).toBe(30); // Velas Perfeitas: perdoa 3
  });

  it("NÃO perdoa nada em curso curto, por causa do arredondamento", () => {
    // 9 × 0,90 = 8,1, que arredondado para cima volta a ser 9.
    expect(aulasNecessarias(9)).toBe(9); // Workshop Buquê: continua exigindo todas
    expect(aulasNecessarias(8)).toBe(8); // Flores de Alto Padrão: idem
  });

  it("passa a perdoar a partir de 10 aulas", () => {
    expect(aulasNecessarias(10)).toBe(9);
    expect(aulasNecessarias(11)).toBe(10);
  });

  it("nunca pede mais aulas do que o curso tem", () => {
    for (let total = 1; total <= 60; total++) {
      expect(aulasNecessarias(total)).toBeLessThanOrEqual(total);
    }
  });

  it("nunca libera o certificado de graça", () => {
    // Curso com aula exige ao menos uma concluída; curso vazio exige zero, e o
    // chamador trata esse caso antes (lessonIds.length === 0 sai mais cedo).
    for (let total = 1; total <= 60; total++) {
      expect(aulasNecessarias(total)).toBeGreaterThan(0);
    }
    expect(aulasNecessarias(0)).toBe(0);
  });

  it("exige mais aulas conforme o curso cresce", () => {
    let anterior = 0;
    for (let total = 1; total <= 60; total++) {
      const agora = aulasNecessarias(total);
      expect(agora).toBeGreaterThanOrEqual(anterior);
      anterior = agora;
    }
  });
});
