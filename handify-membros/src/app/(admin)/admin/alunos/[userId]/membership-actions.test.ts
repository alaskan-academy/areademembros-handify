import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * O que este teste protege: quando uma matrícula do plano falha, a admin PRECISA
 * ficar sabendo. Antes a falha morria num console.error do servidor e a tela dizia
 * "Handify Completo concedido" em verde — a aluna ficava com o plano ativo e sem
 * curso nenhum no painel (dashboard e /cursos listam por enrollments).
 *
 * Nada aqui toca banco nem Resend: o client do Supabase é um dublê e o módulo de
 * e-mail está mockado, então nenhum envio sai deste arquivo.
 */

type Resultado = { data?: unknown; error?: { message: string } | null };
type Contexto = { table: string; op: string; payload?: unknown; filtros: Record<string, unknown> };

/** Dublê encadeável do client do Supabase: responde conforme a tabela e a operação. */
function criarService(responder: (ctx: Contexto) => Resultado) {
  const from = (table: string) => {
    const ctx: Contexto = { table, op: "select", filtros: {} };
    const chain: Record<string, unknown> = {};
    const passa = (nome: string, marca?: string) => {
      chain[nome] = (arg?: unknown) => {
        if (marca) {
          ctx.op = marca;
          ctx.payload = arg;
        }
        return chain;
      };
    };
    for (const m of ["select", "is", "order", "in", "or", "limit"]) passa(m);
    // `eq` precisa ser registrado: é por ele que o dublê sabe de qual curso (ou de
    // qual matrícula) a consulta está falando.
    chain.eq = (coluna: string, valor: unknown) => {
      ctx.filtros[coluna] = valor;
      return chain;
    };
    passa("insert", "insert");
    passa("update", "update");
    passa("delete", "delete");
    chain.single = () => Promise.resolve(responder(ctx));
    chain.maybeSingle = () => Promise.resolve(responder(ctx));
    chain.then = (ok: (v: Resultado) => unknown, falhou?: (e: unknown) => unknown) =>
      Promise.resolve(responder(ctx)).then(ok, falhou);
    return chain;
  };
  return { from };
}

const CURSOS = [
  { id: "c1", title: "Velas Artesanais", slug: "velas-artesanais" },
  { id: "c2", title: "Sabonetes Glicerinados", slug: "sabonetes-glicerinados" },
];

const USER_ID = "11111111-1111-4111-8111-111111111111";

/** Estado que cada teste ajusta antes de chamar a ação. */
const cenario = {
  /** course_id -> erro do insert de enrollments (undefined = insert passa). */
  insertFalha: {} as Record<string, string>,
  /** course_id -> matrícula existente devolvida pelo select. */
  existente: {} as Record<string, { id: string; expires_at: string | null }>,
  /** course_id -> erro do delete da matrícula vencida. */
  deleteFalha: {} as Record<string, string>,
  /** meta gravado no audit_log. */
  auditMeta: null as Record<string, unknown> | null,
};

function responder(ctx: Contexto): Resultado {
  if (ctx.table === "memberships") {
    if (ctx.op === "insert") return { data: { id: "m1" }, error: null };
    if (ctx.op === "update") return { error: null };
    return { data: null }; // nenhuma membership ativa
  }
  if (ctx.table === "courses") return { data: CURSOS };
  if (ctx.table === "profiles") {
    return { data: { email: "aluna@teste.handify", full_name: "Aluna de Teste" } };
  }
  if (ctx.table === "enrollments") {
    if (ctx.op === "insert") {
      const courseId = (ctx.payload as { course_id: string }).course_id;
      const erro = cenario.insertFalha[courseId];
      return erro ? { error: { message: erro } } : { error: null };
    }
    if (ctx.op === "delete") {
      const erro = cenario.deleteFalha[ctx.filtros.id as string];
      return erro ? { error: { message: erro } } : { error: null };
    }
    return { data: cenario.existente[ctx.filtros.course_id as string] ?? null };
  }
  if (ctx.table === "audit_log") {
    cenario.auditMeta = (ctx.payload as { meta: Record<string, unknown> }).meta;
    return { error: null };
  }
  return { data: null, error: null };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./actions", () => ({ getAdminId: vi.fn(async () => "admin-1") }));
vi.mock("@/lib/email", () => ({ sendAccessConfirmedEmail: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => criarService(responder),
}));

import { grantMembershipAction } from "./membership-actions";
import { sendAccessConfirmedEmail } from "@/lib/email";

function formulario() {
  const fd = new FormData();
  fd.set("user_id", USER_ID);
  fd.set("reason", "acordo de suporte");
  fd.set("source", "manual");
  return fd;
}

/** O e-mail sai num IIFE solto; um tick basta para ele ter acontecido (ou não). */
const deixaOEmailAcontecer = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  cenario.insertFalha = {};
  cenario.existente = {};
  cenario.deleteFalha = {};
  cenario.auditMeta = null;
  vi.mocked(sendAccessConfirmedEmail).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("grantMembershipAction — matrícula que falha", () => {
  it("avisa a admin em vermelho quando TODAS as matrículas falham", async () => {
    cenario.insertFalha = { c1: "timeout", c2: "timeout" };

    const r = await grantMembershipAction({}, formulario());
    await deixaOEmailAcontecer();

    // Antes isto voltava como `success` verde dizendo "0 cursos liberados".
    expect(r.success).toBeUndefined();
    expect(r.error).toContain("Velas Artesanais");
    expect(r.error).toContain("Sabonetes Glicerinados");
    expect(r.error).toContain("o plano está ativo");
    expect(r.error).toContain("Dar acesso em lote");
    expect(sendAccessConfirmedEmail).not.toHaveBeenCalled();
  });

  it("registra os cursos que ficaram de fora no audit_log", async () => {
    cenario.insertFalha = { c2: "duplicate key" };

    await grantMembershipAction({}, formulario());
    await deixaOEmailAcontecer();

    expect(cenario.auditMeta).toMatchObject({ courses_granted: 1, courses_failed: 1 });
    expect(cenario.auditMeta?.failed_courses).toEqual([
      { id: "c2", title: "Sabonetes Glicerinados", erro: "duplicate key" },
    ]);
  });

  it("diz que a matrícula vencida foi apagada quando o insert falha depois do delete", async () => {
    cenario.existente = { c1: { id: "e1", expires_at: "2020-01-01T00:00:00.000Z" } };
    cenario.insertFalha = { c1: "conflito" };

    const r = await grantMembershipAction({}, formulario());
    await deixaOEmailAcontecer();

    // O delete acontece ANTES do insert: sem este aviso a aluna fica sem linha
    // nenhuma em enrollments e ninguém sabe.
    const falhas = cenario.auditMeta?.failed_courses as { erro: string }[];
    expect(falhas[0].erro).toContain("a matrícula vencida anterior foi apagada");
    expect(r.error).toContain("Velas Artesanais");
  });

  it("não apaga e não conta como liberado quando o delete da vencida falha", async () => {
    cenario.existente = { c1: { id: "e1", expires_at: "2020-01-01T00:00:00.000Z" } };
    cenario.deleteFalha = { e1: "permissão negada" };

    await grantMembershipAction({}, formulario());
    await deixaOEmailAcontecer();

    const falhas = cenario.auditMeta?.failed_courses as { id: string; erro: string }[];
    expect(falhas).toHaveLength(1);
    expect(falhas[0].erro).toBe("permissão negada");
  });
});

describe("grantMembershipAction — link do e-mail", () => {
  it("manda o slug de um curso que entrou, não o do primeiro da lista", async () => {
    // c1 falha: com `cursos[0]` a aluna recebia o link do curso que NÃO entrou.
    cenario.insertFalha = { c1: "timeout" };

    await grantMembershipAction({}, formulario());
    await deixaOEmailAcontecer();

    expect(sendAccessConfirmedEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAccessConfirmedEmail).mock.calls[0][0]).toMatchObject({
      courseSlug: "sabonetes-glicerinados",
      totalCourses: 1,
    });
  });

  it("segue verde e com um e-mail só quando tudo entra", async () => {
    const r = await grantMembershipAction({}, formulario());
    await deixaOEmailAcontecer();

    expect(r.error).toBeUndefined();
    expect(r.success).toContain("2 cursos liberados");
    expect(sendAccessConfirmedEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAccessConfirmedEmail).mock.calls[0][0]).toMatchObject({
      courseSlug: "velas-artesanais",
      totalCourses: 2,
    });
    expect(cenario.auditMeta).toMatchObject({ courses_failed: 0, failed_courses: [] });
  });
});
