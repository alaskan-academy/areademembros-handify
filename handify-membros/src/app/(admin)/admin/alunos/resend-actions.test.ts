import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Dois defeitos da tela "Sem cadastro".
 *
 * 1. Corrigir o e-mail da compradora reescrevia `payment_events` com um UPDATE
 *    sem SELECT antes, sem id no WHERE e sem guardar o valor antigo. O endereço
 *    com que a compra entrou sumia da coluna consultável — 40 linhas, duas
 *    delas em cascata. E o filtro era um padrão ILIKE, onde `_` é curinga.
 *
 * 2. Criar conta pela tela queimava o token de ativação mesmo quando a
 *    matrícula não entrava. Token queimado = link responde "já foi utilizado" e
 *    a aluna some da aba "Sem cadastro" e do relatório diário, que partem de
 *    `used = false`.
 *
 * Os testes param antes da Resend.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/lib/email", () => ({ sendAccessConfirmedEmail: async () => {} }));

type Linha = Record<string, unknown>;
const tabelas: Record<string, Linha[]> = {};
const ADMIN_ID = "admin-1";

/** Cursos cujo upsert de matrícula falha — para testar o token preservado. */
let cursosQueFalham: string[] = [];
/** Linhas a mais que o ILIKE devolve, imitando o curinga `_`. */
let vizinhosDoIlike: Linha[] = [];

type Filtro = { tipo: "eq" | "in" | "ilike"; col: string; val: unknown };

class Consulta {
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private filtros: Filtro[] = [];
  private payload: Linha | Linha[] = {};
  private um = false;

  constructor(private tabela: string) {}
  private get linhas(): Linha[] { return (tabelas[this.tabela] ??= []); }

  select() { return this; }
  insert(p: Linha | Linha[]) { this.op = "insert"; this.payload = p; return this; }
  upsert(p: Linha | Linha[]) { this.op = "upsert"; this.payload = p; return this; }
  update(p: Linha) { this.op = "update"; this.payload = p; return this; }
  eq(col: string, val: unknown) { this.filtros.push({ tipo: "eq", col, val }); return this; }
  in(col: string, val: unknown[]) { this.filtros.push({ tipo: "in", col, val }); return this; }
  ilike(col: string, val: unknown) { this.filtros.push({ tipo: "ilike", col, val }); return this; }
  not() { return this; }
  order() { return this; }
  single() { this.um = true; return this; }
  maybeSingle() { return this.single(); }

  private casa(l: Linha): boolean {
    return this.filtros.every((f) => {
      const v = l[f.col];
      if (f.tipo === "eq") return v === f.val;
      if (f.tipo === "in") return (f.val as unknown[]).includes(v);
      // O ILIKE do Postgres casaria os vizinhos também — quem separa é o
      // filtro exato em JS, que é o que este teste cobra.
      return String(v ?? "").toLowerCase() === String(f.val ?? "").replace(/\\/g, "").toLowerCase();
    });
  }

  then(resolve: (r: { data: unknown; error: unknown }) => void) {
    if (this.op === "insert" || this.op === "upsert") {
      const novos = Array.isArray(this.payload) ? this.payload : [this.payload];
      const curso = novos[0]?.course_id as string | undefined;
      if (this.tabela === "enrollments" && curso && cursosQueFalham.includes(curso)) {
        return resolve({ data: null, error: { message: "violação de FK" } });
      }
      this.linhas.push(...novos.map((n) => ({ ...n })));
      return resolve({ data: novos, error: null });
    }

    const alvo = this.linhas.filter((l) => this.casa(l));

    if (this.op === "update") {
      for (const l of alvo) Object.assign(l, this.payload);
      return resolve({ data: alvo, error: null });
    }

    // Só `payment_events` recebe os vizinhos: é lá que o padrão frouxo
    // arrastaria o pagamento de outra compradora.
    const usaIlike = this.tabela === "payment_events" && this.filtros.some((f) => f.tipo === "ilike");
    const dados = usaIlike ? [...alvo, ...vizinhosDoIlike] : alvo;
    if (this.um) {
      return resolve(dados.length ? { data: dados[0], error: null } : { data: null, error: { message: "no rows" } });
    }
    return resolve({ data: dados, error: null });
  }
}

const clienteFalso = {
  from: (t: string) => new Consulta(t),
  auth: {
    getUser: async () => ({ data: { user: { id: ADMIN_ID } } }),
    admin: {
      createUser: async ({ email }: { email: string }) => ({
        data: { user: { id: `novo-${email}` } },
        error: null,
      }),
    },
  },
};

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFalso }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFalso }));

beforeEach(() => {
  for (const k of Object.keys(tabelas)) delete tabelas[k];
  tabelas.profiles = [{ id: ADMIN_ID, role: "admin", full_name: "Jessica", email: "admin@handify.com.br" }];
  cursosQueFalham = [];
  vizinhosDoIlike = [];
});

describe("correção de e-mail da compradora", () => {
  beforeEach(() => {
    tabelas.activation_tokens = [
      { id: "t1", token: "tok1", email: "ale_brunheira@tahoo.com", used: false, expires_at: "2026-01-01T00:00:00Z", courses: null },
    ];
  });

  it("guarda o endereço de entrada em vez de apagá-lo", async () => {
    tabelas.payment_events = [
      { id: "pe1", buyer_email: "ale_brunheira@tahoo.com", buyer_email_original: null },
    ];

    const { correctEmailAction } = await import("./resend-actions");
    await correctEmailAction("ale_brunheira@tahoo.com", "ale_brunheira@yahoo.com");

    expect(tabelas.payment_events[0]).toMatchObject({
      buyer_email: "ale_brunheira@yahoo.com",
      buyer_email_original: "ale_brunheira@tahoo.com",
    });
    expect(tabelas.buyer_email_corrections[0]).toMatchObject({
      old_email: "ale_brunheira@tahoo.com",
      new_email: "ale_brunheira@yahoo.com",
      payment_event_ids: ["pe1"],
    });
  });

  it("não arrasta o pagamento da vizinha que o curinga `_` casaria", async () => {
    tabelas.payment_events = [
      { id: "pe1", buyer_email: "ale_brunheira@tahoo.com", buyer_email_original: null },
    ];
    // O que um `_` não escapado traria junto no ILIKE.
    vizinhosDoIlike = [
      { id: "pe2", buyer_email: "aleXbrunheira@tahoo.com", buyer_email_original: null },
    ];
    tabelas.payment_events.push(vizinhosDoIlike[0]);

    const { correctEmailAction } = await import("./resend-actions");
    await correctEmailAction("ale_brunheira@tahoo.com", "ale_brunheira@yahoo.com");

    expect(tabelas.payment_events.find((e) => e.id === "pe2")).toMatchObject({
      buyer_email: "aleXbrunheira@tahoo.com",
      buyer_email_original: null,
    });
    expect(tabelas.buyer_email_corrections[0].payment_event_ids).toEqual(["pe1"]);
  });

  it("numa segunda correção, preserva o primeiro endereço", async () => {
    tabelas.payment_events = [
      { id: "pe1", buyer_email: "adrianaalamino08@gmail.com", buyer_email_original: "adrianaliberato08@hotmail.com" },
    ];
    tabelas.activation_tokens[0].email = "adrianaalamino08@gmail.com";

    const { correctEmailAction } = await import("./resend-actions");
    await correctEmailAction("adrianaalamino08@gmail.com", "alaminojunior@gmail.com");

    expect(tabelas.payment_events[0].buyer_email_original).toBe("adrianaliberato08@hotmail.com");
  });
});

describe("criar conta pela tela Sem cadastro", () => {
  it("não queima o token quando a matrícula não entra", async () => {
    tabelas.activation_tokens = [
      { token: "tokA", course_id: "cursoA", email: "nova@handify.com.br", used: false, buyer_name: "Nova", buyer_phone: null },
      { token: "tokB", course_id: "cursoB", email: "nova@handify.com.br", used: false, buyer_name: "Nova", buyer_phone: null },
    ];
    cursosQueFalham = ["cursoB"];

    const { createAccountAndSetPasswordAction } = await import("./resend-actions");
    const r = await createAccountAndSetPasswordAction("nova@handify.com.br", "senha12345");

    expect(r.userId).toBeTruthy();
    expect(tabelas.activation_tokens.find((t) => t.token === "tokA")!.used).toBe(true);
    // O curso que não entrou mantém o link vivo e o caso visível no relatório.
    expect(tabelas.activation_tokens.find((t) => t.token === "tokB")!.used).toBe(false);

    const log = tabelas.audit_log.find((l) => l.action === "create_account_with_password");
    expect((log!.meta as Linha).enrollments_granted).toBe(1);
    expect((log!.meta as Linha).enrollments_failed).toEqual(["cursoB"]);
  });
});
