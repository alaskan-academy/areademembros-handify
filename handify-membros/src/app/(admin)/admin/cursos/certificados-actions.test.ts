import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Guarda a ordem estável das três consultas paginadas de `alunasSemCertificado`.
 *
 * O fake abaixo imita o Postgres no ponto que interessa: quando a consulta NÃO
 * pede ordem, cada página é uma varredura independente e pode devolver as
 * linhas embaralhadas — é assim que LIMIT/OFFSET se comporta sem ORDER BY. O
 * cenário montado aqui tem 1.020 linhas de progresso (duas páginas) e uma aluna
 * que concluiu o curso inteiro por uma linha só. Sem `.order("id")` essa linha
 * cai no vão entre as páginas, a aluna some da lista de pendentes e ninguém vê
 * erro nenhum. É esse desaparecimento silencioso que o teste trava.
 */

const estado = vi.hoisted(() => ({
  service: null as unknown,
  admin: null as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Só a emissão é dublada: ela gera PDF, sobe para o Storage e manda e-mail.
// `aulasNecessarias` passa de verdade, porque é a régua que este teste precisa
// enxergar — dublar o limiar aqui seria testar o número errado.
vi.mock("@/lib/certificates/issue", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/certificates/issue")>()),
  issueCertificateIfComplete: vi.fn(async () => false),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => estado.admin }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => estado.service }));

import { contarCertificadosPendentes } from "./certificados-actions";
import { aulasNecessarias } from "@/lib/certificates/issue";

type Linha = Record<string, unknown>;
type Pagina = { data: Linha[] | null; error: unknown };

const CURSO = "curso-1";
const TOTAL_AULAS = 20;
// Vem da mesma função que a produção usa. Escrito à mão, este número
// envelhecia junto com o limiar: quando ele caiu de 0,95 para 0,90 a aluna
// sentinela parou de ficar exatamente no limite, e o teste deixou de sentir o
// defeito que existe para pegar.
const LIMIAR = aulasNecessarias(TOTAL_AULAS);

/** Ordena por qual coluna cada tabela foi consultada — null quando não pediu. */
type Ordens = Record<string, string | null>;

function criarServiceFake(tabelas: Record<string, Linha[]>, ordens: Ordens) {
  return {
    from(tabela: string) {
      const base = tabelas[tabela] ?? [];
      const filtros: ((l: Linha) => boolean)[] = [];
      let temOrdem = false;

      const filtrar = () => base.filter((l) => filtros.every((f) => f(l)));

      const consulta = {
        select: () => consulta,
        or: () => consulta, // no fake nenhuma matrícula expira
        eq(coluna: string, valor: unknown) {
          filtros.push((l) => l[coluna] === valor);
          return consulta;
        },
        in(coluna: string, valores: unknown[]) {
          filtros.push((l) => valores.includes(l[coluna]));
          return consulta;
        },
        order(coluna: string) {
          temOrdem = true;
          ordens[tabela] = coluna;
          return consulta;
        },
        async single() {
          return { data: filtrar()[0] ?? null, error: null };
        },
        range(de: number, ate: number): Promise<Pagina> {
          const linhas = filtrar();
          // Sem ORDER BY, cada página é uma varredura nova: aqui a de índice 1
          // vem rotacionada em uma posição, que é o efeito real — uma linha
          // pulada e outra repetida entre as páginas.
          const giro = temOrdem ? 0 : Math.floor(de / 1000);
          const visao = giro
            ? linhas.map((_, i) => linhas[(i + giro) % linhas.length])
            : linhas;
          return Promise.resolve({ data: visao.slice(de, ate + 1), error: null });
        },
        then<R>(resolver: (p: Pagina) => R) {
          return Promise.resolve({ data: filtrar(), error: null }).then(resolver);
        },
      };

      return consulta;
    },
  };
}

function criarAdminFake() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { role: "admin" }, error: null }) }),
      }),
    }),
  };
}

/**
 * Monta o cenário com a linha decisiva no índice 1.000 — exatamente a primeira
 * que a segunda página perde quando não há ordem.
 */
function montarDados() {
  const lessonIds = Array.from({ length: TOTAL_AULAS }, (_, i) => `aula-${i}`);

  const progresso: Linha[] = [];
  const alunas = new Set<string>();
  const empurrar = (userId: string, quantas: number) => {
    alunas.add(userId);
    for (let i = 0; i < quantas; i++) {
      progresso.push({
        id: `prog-${progresso.length}`,
        user_id: userId,
        lesson_id: lessonIds[i],
        completed: true,
      });
    }
  };

  // A sentinela precisa ter a ÚLTIMA linha exatamente no índice 1.000, a
  // primeira que a segunda página perde quando não há ordem. Antes isso era
  // obtido com contas feitas à mão para um limiar de 19; o enchimento abaixo se
  // posiciona sozinho, então mudar o limiar não desarma mais o teste.
  const alvoAntesDaSentinela = 1001 - LIMIAR;

  empurrar("aluna-quase", LIMIAR - 1); // uma aula abaixo: nunca entra
  const cheias = Math.floor((alvoAntesDaSentinela - (LIMIAR - 1)) / LIMIAR);
  for (let i = 0; i < cheias; i++) empurrar(`aluna-ok-${i}`, LIMIAR);
  const resto = alvoAntesDaSentinela - progresso.length;
  // `resto` é menor que LIMIAR por construção, então esta aluna nunca qualifica.
  if (resto > 0) empurrar("aluna-parcial", resto);

  // Exatamente no limite: perder UMA linha dela na paginação já a derruba.
  // É o que faz o teste sentir a falta de ordem estável.
  empurrar("aluna-limiar", LIMIAR);
  empurrar("aluna-extra", LIMIAR);

  expect(resto).toBeLessThan(LIMIAR);
  expect(progresso[1000]).toMatchObject({ user_id: "aluna-limiar" });
  expect(progresso[1001]).toMatchObject({ user_id: "aluna-extra" });

  const matriculas: Linha[] = [...alunas].map((userId, i) => ({
    id: `mat-${i}`,
    course_id: CURSO,
    user_id: userId,
    expires_at: null,
  }));

  return {
    courses: [{ id: CURSO, has_certificate: true, course_type: "course" }],
    modules: [
      {
        course_id: CURSO,
        archived: false,
        lessons: lessonIds.map((id) => ({ id, archived: false })),
      },
    ],
    enrollments: matriculas,
    lesson_progress: progresso,
    certificates: [] as Linha[],
    // Quem de fato cumpre o requisito: as cheias + a sentinela + a extra.
    esperadas: cheias + 2,
  };
}

describe("alunasSemCertificado", () => {
  let ordens: Ordens;
  let esperadas: number;

  beforeEach(() => {
    ordens = {};
    const dados = montarDados();
    esperadas = dados.esperadas;
    estado.service = criarServiceFake(dados, ordens);
    estado.admin = criarAdminFake();
  });

  it("não perde a aluna que concluiu quando o progresso passa de uma página", async () => {
    // Sem ordem estável a aluna-limiar perde uma linha, cai abaixo do limiar e
    // o número vem um a menos.
    expect(await contarCertificadosPendentes(CURSO)).toBe(esperadas);
  });

  it("ordena as três consultas paginadas por id", async () => {
    await contarCertificadosPendentes(CURSO);

    // `id` e não `granted_at`/`issued_at`: só a PK não deixa empate, e empate
    // entre páginas reabre exatamente o mesmo buraco.
    expect(ordens.enrollments).toBe("id");
    expect(ordens.lesson_progress).toBe("id");
    expect(ordens.certificates).toBe("id");
  });
});
