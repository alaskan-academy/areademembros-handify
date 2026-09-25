import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A sequência de 3 e-mails do Handify Completo não perguntava, em etapa
 * nenhuma, se a aluna ainda era aluna.
 *
 * Ela é DISPARADA por `certificates` (concluiu o primeiro curso) e CONTINUADA
 * por `email_campaign_sends` (faz 30 dias da anterior). Nenhuma das duas fontes
 * sabe de reembolso, e o filtro que existia olhava só banida e opt-out.
 *
 * Resultado medido em 25/09/2026: uma aluna estornada em 19/09, com zero acesso,
 * tinha a etapa 2 marcada para 14/10 e a etapa 3 para ~13/11, e não havia uma
 * linha de código que a tirasse. Pior: a lista de cursos do e-mail lia
 * `enrollments` SEM `expires_at`, então o "você já tem estes cursos" incluía os
 * que ela tinha acabado de perder.
 */

type Chamada = { tabela: string; metodo: string; args: unknown[] };
let chamadas: Chamada[] = [];

/** Certificados recentes — quem entra na etapa 1. */
let certificadosRecentes: { user_id: string; course_id: string; issued_at: string }[] = [];
/** Todos os certificados de quem entrou (para saber se é o primeiro). */
let certificadosTotais: { user_id: string }[] = [];
/** Perfis das alvos. */
let perfis: { id: string; full_name: string; email: string; banned: boolean; email_prefs: null }[] = [];
/** Matrículas ATIVAS — a consulta agora filtra `expires_at`, então o mock só devolve as vivas. */
let matriculasAtivas: { user_id: string; course_id: string }[] = [];
/** Etapas já enviadas, que alimentam as etapas 2 e 3. */
let enviosAnteriores: { campaign: string; user_id: string; sent_at: string }[] = [];

function construtor(tabela: string) {
  const cadeia: string[] = [];
  let filtrouExpiracao = false;
  const alvo: Record<string, unknown> = {
    then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
      let r: { data: unknown; error: unknown } = { data: [], error: null };
      if (tabela === "certificates") {
        r = { data: cadeia.includes("in") ? certificadosTotais : certificadosRecentes, error: null };
      } else if (tabela === "profiles") {
        r = { data: perfis, error: null };
      } else if (tabela === "enrollments") {
        // Se o código NÃO filtrou expiração, devolve tudo — é assim que o teste
        // percebe a falta do filtro em vez de premiá-la.
        r = { data: filtrouExpiracao ? matriculasAtivas : [...matriculasAtivas, ...revogadas], error: null };
      } else if (tabela === "courses") {
        r = { data: [{ id: "c1", title: "Curso Saponaria Brasil" }], error: null };
      }
      return Promise.resolve(r).then(onOk, onErr);
    },
  };
  for (const m of ["select", "insert", "update", "upsert", "eq", "in", "is", "not", "gte", "lte", "or", "like", "order", "range", "limit", "maybeSingle", "single"]) {
    alvo[m] = (...args: unknown[]) => {
      cadeia.push(m);
      if (m === "or" && String(args[0]).includes("expires_at")) filtrouExpiracao = true;
      chamadas.push({ tabela, metodo: m, args });
      return alvo;
    };
  }
  return alvo;
}

/** Matrículas que a aluna PERDEU. Nunca podem aparecer no e-mail. */
let revogadas: { user_id: string; course_id: string }[] = [];

const clienteFalso = { from: (t: string) => construtor(t) };

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFalso }));
vi.mock("next/server", () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}));
const buscarTudo = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/supabase/fetch-all", () => ({ fetchAll: (...a: unknown[]) => buscarTudo(...(a as [])) }));
const enviarLote = vi.fn(async () => ({ enviados: [] as string[], erro: null }));
vi.mock("@/lib/email", () => ({ sendPlanUpgradeEmailBatch: enviarLote }));
vi.mock("@/lib/campanhas/completo", () => ({
  CAMPANHA_CONCLUSAO: "plano-completo-conclusao",
  ETAPAS_CONCLUSAO: 3,
  DIAS_ENTRE_ETAPAS: 30,
  comPlanoAtivo: async () => new Set<string>(),
  cursosDoPlano: async () => new Map([["c1", "Curso Saponaria Brasil"]]),
  jaConvidadas: async () => new Set<string>(),
  linkComUtm: (base: string) => base,
  linkDoPlano: async () => "https://exemplo/plano",
  reservarEnvios: async () => new Set<string>(),
  desfazerReservas: async () => {},
}));

const ONTEM = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function pedido() {
  return {
    headers: { get: (k: string) => (k === "authorization" ? "Bearer segredo" : null) },
    url: "https://exemplo/api/cron/convite-completo?simular=1",
  } as unknown as Parameters<typeof import("./route").GET>[0];
}

beforeEach(() => {
  process.env.CRON_SECRET = "segredo";
  chamadas = [];
  certificadosRecentes = [{ user_id: "aluna", course_id: "c1", issued_at: ONTEM }];
  certificadosTotais = [{ user_id: "aluna" }];
  perfis = [{ id: "aluna", full_name: "Ana", email: "ana@exemplo.com", banned: false, email_prefs: null }];
  matriculasAtivas = [{ user_id: "aluna", course_id: "c1" }];
  revogadas = [];
  enviosAnteriores = [];
  buscarTudo.mockReset();
  buscarTudo.mockImplementation(async () => enviosAnteriores);
  enviarLote.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function fila() {
  const { GET } = await import("./route");
  const r = (await GET(pedido())) as unknown as { body: { naFila?: { etapa: number; quantas: number }[] } };
  return r.body.naFila ?? [];
}

describe("etapa 1 — quem acabou de concluir o primeiro curso", () => {
  it("aluna com curso ativo entra na fila", async () => {
    expect(await fila()).toEqual([{ etapa: 1, quantas: 1, exemplo: "ana@exemplo.com" }]);
  });

  it("estornada, sem nenhum curso ativo, NÃO entra", async () => {
    // Concluiu o curso, ganhou o certificado, pediu reembolso. O certificado
    // continua lá — é por isso que só olhar `certificates` não basta.
    matriculasAtivas = [];
    revogadas = [{ user_id: "aluna", course_id: "c1" }];
    expect(await fila()).toEqual([]);
  });

  it("banida não entra, como já era", async () => {
    perfis = [{ ...perfis[0], banned: true }];
    expect(await fila()).toEqual([]);
  });
});

describe("etapas 2 e 3 — quem já recebeu a anterior", () => {
  const umMesAtras = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    certificadosRecentes = [];
    certificadosTotais = [];
    enviosAnteriores = [
      { campaign: "plano-completo-conclusao-1", user_id: "aluna", sent_at: umMesAtras },
    ];
  });

  it("com curso ativo, segue para a etapa 2", async () => {
    expect(await fila()).toEqual([{ etapa: 2, quantas: 1, exemplo: "ana@exemplo.com" }]);
  });

  it("estornada no meio da sequência não recebe a etapa 2", async () => {
    // É o caso real: recebeu a etapa 1 em 14/09, estornou em 19/09, e a etapa 2
    // estava marcada para 14/10 sem nada para impedir.
    matriculasAtivas = [];
    revogadas = [{ user_id: "aluna", course_id: "c1" }];
    expect(await fila()).toEqual([]);
  });
});

describe("o e-mail não pode chamar de 'seu' um curso revogado", () => {
  it("a consulta de matrículas filtra expires_at", async () => {
    await fila();
    const consultaDeMatricula = chamadas.filter(
      (c) => c.tabela === "enrollments" && c.metodo === "or"
    );
    expect(consultaDeMatricula.length).toBeGreaterThan(0);
    expect(String(consultaDeMatricula[0].args[0])).toContain("expires_at.is.null");
    expect(String(consultaDeMatricula[0].args[0])).toContain("expires_at.gt.");
  });
});
