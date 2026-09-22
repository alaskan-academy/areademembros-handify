import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Quatro defeitos da tela de cursos do admin, todos da mesma família: a ação
 * acontecia sem perguntar quem ela alcança.
 *
 * - publicar curso reenviava o anúncio para a base inteira a cada clique, e só
 *   alcançava as 1.000 primeiras alunas de 4.558;
 * - a matrícula retroativa perguntava por um campo que só guarda o produto
 *   principal da compra, e queimava o token de quem nunca foi matriculada;
 * - apagar curso levava matrícula, certificado e progresso junto, sem contar e
 *   sem registrar.
 *
 * Os testes param antes da Resend: o banco falso é onde os defeitos moram.
 */

// `server-only` estoura fora do bundler; o fetchAll real é justamente o que
// queremos exercitar aqui (a paginação).
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const depoisDaResposta: Promise<unknown>[] = [];
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    depoisDaResposta.push(Promise.resolve().then(fn));
  },
}));

const lotesEnviados: { to: string }[][] = [];
let recusarEndereco: string | null = null;
vi.mock("@/lib/email", () => ({
  sendNewCourseEmailBatch: async (destinatarias: { to: string }[]) => {
    lotesEnviados.push(destinatarias);
    const aceitos = destinatarias
      .filter((d) => d.to !== recusarEndereco)
      .map((d) => d.to);
    return { enviados: aceitos, erro: null };
  },
}));

// ─── Banco falso ─────────────────────────────────────────────────────────────

type Linha = Record<string, unknown>;
const tabelas: Record<string, Linha[]> = {};
let respostaRpc: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const rpcChamadas: { nome: string; args: unknown }[] = [];

const ADMIN_ID = "admin-1";

type Filtro = { tipo: "eq" | "is" | "in"; col: string; val: unknown };

class Consulta {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private filtros: Filtro[] = [];
  private payload: Linha | Linha[] = {};
  private contar = false;
  private cabeca = false;
  private devolveLinhas = false;
  private um = false;
  private ordem: string | null = null;
  private faixa: [number, number] | null = null;

  constructor(private tabela: string) {}

  private get linhas(): Linha[] {
    return (tabelas[this.tabela] ??= []);
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") this.op = "select";
    this.devolveLinhas = true;
    this.contar = opts?.count === "exact";
    this.cabeca = opts?.head === true;
    return this;
  }
  insert(payload: Linha | Linha[]) { this.op = "insert"; this.payload = payload; return this; }
  upsert(payload: Linha | Linha[]) { this.op = "upsert"; this.payload = payload; return this; }
  update(payload: Linha) { this.op = "update"; this.payload = payload; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, val: unknown) { this.filtros.push({ tipo: "eq", col, val }); return this; }
  is(col: string, val: unknown) { this.filtros.push({ tipo: "is", col, val }); return this; }
  in(col: string, val: unknown[]) { this.filtros.push({ tipo: "in", col, val }); return this; }
  not(col: string, _op: string, val: unknown) { this.filtros.push({ tipo: "is", col, val: { nao: val } }); return this; }
  order(col: string) { this.ordem = col; return this; }
  range(de: number, ate: number) { this.faixa = [de, ate]; return this; }
  single() { this.um = true; this.devolveLinhas = true; return this; }
  maybeSingle() { return this.single(); }

  private casa(l: Linha): boolean {
    return this.filtros.every((f) => {
      const v = l[f.col];
      if (f.tipo === "eq") return v === f.val;
      if (f.tipo === "in") return (f.val as unknown[]).includes(v);
      // `is` e `not(col, "is", val)`
      if (typeof f.val === "object" && f.val !== null && "nao" in (f.val as Linha)) {
        return v !== (f.val as { nao: unknown }).nao;
      }
      return (v ?? null) === (f.val ?? null);
    });
  }

  then(resolve: (r: { data: unknown; error: unknown; count?: number }) => void) {
    let alvo = this.linhas.filter((l) => this.casa(l));

    if (this.op === "insert" || this.op === "upsert") {
      const novos = Array.isArray(this.payload) ? this.payload : [this.payload];
      this.linhas.push(...novos.map((n) => ({ ...n })));
      return resolve({ data: novos, error: null });
    }
    if (this.op === "update") {
      for (const l of alvo) Object.assign(l, this.payload);
      return resolve({ data: this.devolveLinhas ? alvo : null, error: null });
    }
    if (this.op === "delete") {
      tabelas[this.tabela] = this.linhas.filter((l) => !this.casa(l));
      return resolve({ data: null, error: null });
    }

    if (this.contar) return resolve({ data: this.cabeca ? null : alvo, error: null, count: alvo.length });
    if (this.ordem) {
      const col = this.ordem;
      alvo = [...alvo].sort((a, b) => String(a[col]).localeCompare(String(b[col])));
    }
    if (this.faixa) alvo = alvo.slice(this.faixa[0], this.faixa[1] + 1);
    if (this.um) {
      return resolve(
        alvo.length
          ? { data: alvo[0], error: null }
          : { data: null, error: { message: "no rows" } }
      );
    }
    return resolve({ data: alvo, error: null });
  }
}

const clienteFalso = {
  from: (t: string) => new Consulta(t),
  rpc: async (nome: string, args: unknown) => {
    rpcChamadas.push({ nome, args });
    return respostaRpc;
  },
  auth: { getUser: async () => ({ data: { user: { id: ADMIN_ID } } }) },
};

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFalso }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFalso }));

function reset() {
  for (const k of Object.keys(tabelas)) delete tabelas[k];
  tabelas.profiles = [{ id: ADMIN_ID, role: "admin", email: "admin@handify.com.br" }];
  depoisDaResposta.length = 0;
  lotesEnviados.length = 0;
  rpcChamadas.length = 0;
  recusarEndereco = null;
  respostaRpc = { data: [], error: null };
}

async function esperarOAfter() {
  await Promise.all(depoisDaResposta);
  depoisDaResposta.length = 0;
}

function aluna(i: number, extra: Linha = {}): Linha {
  return {
    id: `aluna-${String(i).padStart(4, "0")}`,
    role: "student",
    full_name: `Aluna ${i}`,
    email: `aluna${i}@handify.com.br`,
    email_prefs: null,
    banned: false,
    ...extra,
  };
}

beforeEach(reset);

// ─── Anúncio de curso novo ───────────────────────────────────────────────────

describe("anúncio de curso novo", () => {
  it("alcança quem está depois da linha 1.000 e anuncia uma vez só", async () => {
    tabelas.courses = [{ id: "c1", title: "Velas", slug: "velas", description: null, thumbnail_url: null, published: false, announced_at: null }];
    tabelas.profiles.push(...Array.from({ length: 1500 }, (_, i) => aluna(i)));

    const { togglePublished } = await import("./actions");

    await togglePublished("c1", true);
    await esperarOAfter();

    const registrados = tabelas.email_campaign_sends ?? [];
    // O select solto trazia 1.000 de 1.500 — e sem ordem, 1.000 arbitrárias.
    expect(registrados.length).toBe(1500);
    expect(lotesEnviados.flat().length).toBe(1500);
    // Lotes de 100: o limite da Resend.
    expect(Math.max(...lotesEnviados.map((l) => l.length))).toBe(100);
    expect(tabelas.courses[0].announced_at).not.toBeNull();

    // Segundo clique: despublicar e republicar não pode reenviar nada.
    lotesEnviados.length = 0;
    await togglePublished("c1", false);
    await togglePublished("c1", true);
    await esperarOAfter();

    expect(lotesEnviados.length).toBe(0);
    expect((tabelas.email_campaign_sends ?? []).length).toBe(1500);
    expect(tabelas.audit_log.filter((l) => l.action === "course.announced").length).toBe(1);
  });

  it("não manda para banida, para quem pediu para sair, nem para quem já recebeu", async () => {
    tabelas.courses = [{ id: "c1", title: "Velas", slug: "velas", description: null, thumbnail_url: null, published: false, announced_at: null }];
    tabelas.profiles.push(
      aluna(1),
      aluna(2, { banned: true }),
      aluna(3, { email_prefs: { new_course: false } }),
      aluna(4)
    );
    tabelas.email_campaign_sends = [
      { campaign: "novo-curso-c1", user_id: "aluna-0004", email: "aluna4@handify.com.br" },
    ];

    const { togglePublished } = await import("./actions");
    await togglePublished("c1", true);
    await esperarOAfter();

    expect(lotesEnviados.flat().map((d) => d.to)).toEqual(["aluna1@handify.com.br"]);
  });

  it("registra só quem a Resend aceitou", async () => {
    tabelas.courses = [{ id: "c1", title: "Velas", slug: "velas", description: null, thumbnail_url: null, published: false, announced_at: null }];
    tabelas.profiles.push(aluna(1), aluna(2));
    recusarEndereco = "aluna2@handify.com.br";

    const { togglePublished } = await import("./actions");
    await togglePublished("c1", true);
    await esperarOAfter();

    expect((tabelas.email_campaign_sends ?? []).map((r) => r.user_id)).toEqual(["aluna-0001"]);
  });

  it("salvar o formulário de um curso já anunciado não dispara nada", async () => {
    tabelas.courses = [{ id: "c1", title: "Velas", slug: "velas", description: null, thumbnail_url: null, published: true, announced_at: "2026-07-28T00:00:00Z" }];
    tabelas.profiles.push(aluna(1));

    const { updateCourse } = await import("./actions");
    const form = new FormData();
    form.set("title", "Velas artesanais");
    form.set("slug", "velas");
    form.set("description", "");
    form.set("price", "97");
    form.set("checkout_codes", "ABC123");
    form.set("workload_hours", "4");
    form.set("published", "true");

    await updateCourse("c1", form);
    await esperarOAfter();

    expect(lotesEnviados.length).toBe(0);
  });
});

// ─── Matrícula retroativa ────────────────────────────────────────────────────

describe("matrícula retroativa", () => {
  beforeEach(() => {
    tabelas.courses = [{ id: "c1", title: "Velas", checkout_codes: ["ABC123"], in_plan: false, access_days: null }];
  });

  it("pergunta à RPC e matricula com upsert, não insert", async () => {
    respostaRpc = {
      data: [{ user_id: "aluna-0001", email: "Aluna1@Handify.com.br" }],
      error: null,
    };
    // Linha revogada: o `insert` antigo estouraria e a checagem antiga a
    // tratava como "já matriculada", que é o defeito que se anulava com o
    // filtro de estorno ausente.
    tabelas.enrollments = [
      { user_id: "aluna-0001", course_id: "c1", expires_at: "2026-01-01T00:00:00Z" },
    ];

    const { retroactiveEnroll } = await import("./actions");
    const r = await retroactiveEnroll("c1");

    expect(rpcChamadas[0]).toEqual({
      nome: "alunas_para_matricula_retroativa",
      args: { p_course_id: "c1", p_limite: 500 },
    });
    expect(r).toEqual({ count: 1, parcial: false });
    expect(tabelas.enrollments.at(-1)).toMatchObject({
      user_id: "aluna-0001",
      course_id: "c1",
      source: "manual",
    });
  });

  it("queima só o token de quem ficou matriculada", async () => {
    respostaRpc = { data: [{ user_id: "aluna-0001", email: "aluna1@handify.com.br" }], error: null };
    tabelas.activation_tokens = [
      { token: "t1", course_id: "c1", email: "aluna1@handify.com.br", used: false },
      // Pagou, nunca criou conta: não é matriculada aqui. Queimar o token dela
      // deixava o link respondendo "já foi utilizado" e a tirava da aba
      // "Sem cadastro" e do relatório de compras sem acesso.
      { token: "t2", course_id: "c1", email: "semconta@handify.com.br", used: false },
    ];

    const { retroactiveEnroll } = await import("./actions");
    await retroactiveEnroll("c1");

    expect(tabelas.activation_tokens.find((t) => t.token === "t1")!.used).toBe(true);
    expect(tabelas.activation_tokens.find((t) => t.token === "t2")!.used).toBe(false);
  });

  it("avisa quando o resultado veio no limite e registra em audit_log", async () => {
    respostaRpc = {
      data: Array.from({ length: 500 }, (_, i) => ({ user_id: `u${i}`, email: `u${i}@x.com` })),
      error: null,
    };

    const { retroactiveEnroll } = await import("./actions");
    const r = await retroactiveEnroll("c1");

    expect(r.parcial).toBe(true);
    const log = tabelas.audit_log.find((l) => l.action === "enrollment.retroactive");
    expect(log).toBeTruthy();
    expect((log!.meta as Linha).concedidas).toBe(500);
  });
});

// ─── Exclusão de curso ───────────────────────────────────────────────────────

describe("exclusão de curso", () => {
  beforeEach(() => {
    tabelas.courses = [{ id: "c1", title: "Saponária", slug: "saponaria", published: true, checkout_codes: ["ABC"] }];
    tabelas.modules = [{ id: "m1", course_id: "c1" }];
    tabelas.lessons = [{ id: "l1", module_id: "m1" }];
    tabelas.certificates = [];
    tabelas.forum_posts = [];
  });

  it("recusa curso com matrícula e não apaga nada", async () => {
    tabelas.enrollments = Array.from({ length: 1200 }, (_, i) => ({
      id: `e${i}`, user_id: `u${i}`, course_id: "c1",
    }));

    const { deleteCourse } = await import("./actions");
    const r = await deleteCourse("c1");

    expect(r.error).toContain("1200 matricula(s)");
    expect(tabelas.courses.length).toBe(1);
    expect(tabelas.audit_log ?? []).toEqual([]);
  });

  it("apaga curso vazio e grava o retrato ANTES de sumir com as linhas", async () => {
    tabelas.enrollments = [];

    const { deleteCourse } = await import("./actions");
    const r = await deleteCourse("c1");

    expect(r).toEqual({});
    expect(tabelas.courses.length).toBe(0);
    const log = tabelas.audit_log.find((l) => l.action === "course.deleted");
    expect(log).toBeTruthy();
    expect((log!.meta as Linha)).toMatchObject({ title: "Saponária", modules_count: 1, lessons_count: 1 });
  });

  it("no caminho force, a lista de quem perde acesso não para em 1.000", async () => {
    tabelas.enrollments = Array.from({ length: 1500 }, (_, i) => ({
      id: `e${i}`, user_id: `u${String(i).padStart(4, "0")}`, course_id: "c1",
    }));

    const { deleteCourse } = await import("./actions");
    await deleteCourse("c1", true);

    const log = tabelas.audit_log.find((l) => l.action === "course.deleted");
    expect(((log!.meta as Linha).enrolled_user_ids as string[]).length).toBe(1500);
  });
});
