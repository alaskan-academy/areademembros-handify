import { describe, it, expect, vi } from "vitest";

// `completo.ts` e `fetch-all.ts` são módulos de servidor; no Vitest o pacote
// `server-only` joga na importação.
vi.mock("server-only", () => ({}));

const {
  jaConvidadas,
  comPlanoAtivo,
  matriculasPorAluna,
  reservarEnvios,
  desfazerReservas,
} = await import("./completo");

type Chamada = { metodo: string; args: unknown[] };
type Resposta = { data: unknown[] | null; error: { message: string } | null };

/**
 * Cliente Supabase de mentira: cada `.from()` abre um builder novo que anota a
 * cadeia de chamadas e devolve o que o teste mandar. Nenhuma linha sai daqui —
 * não encosta no banco nem na Resend.
 */
function criarService(porTabela: Record<string, (c: Chamada[]) => Resposta>) {
  const historico: { tabela: string; chamadas: Chamada[] }[] = [];

  const from = (tabela: string) => {
    const chamadas: Chamada[] = [];
    historico.push({ tabela, chamadas });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {};
    for (const metodo of ["select", "like", "eq", "is", "or", "order", "range", "upsert", "delete", "in"]) {
      builder[metodo] = (...args: unknown[]) => {
        chamadas.push({ metodo, args });
        return builder;
      };
    }
    builder.then = (ok: (r: Resposta) => unknown, falhou?: (e: unknown) => unknown) => {
      const responder = porTabela[tabela];
      if (!responder) throw new Error(`tabela inesperada no teste: ${tabela}`);
      return Promise.resolve(responder(chamadas)).then(ok, falhou);
    };
    return builder;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: { from } as any, historico };
}

/** Responde uma página de `linhas` conforme o `.range()` que veio na cadeia. */
function paginar(linhas: unknown[]) {
  return (chamadas: Chamada[]): Resposta => {
    const range = chamadas.find((c) => c.metodo === "range");
    if (!range) throw new Error("consulta sem .range() — não pagina");
    const [de, ate] = range.args as [number, number];
    return { data: linhas.slice(de, ate + 1), error: null };
  };
}

const ordens = (chamadas: Chamada[]) => chamadas.filter((c) => c.metodo === "order").map((c) => c.args[0]);

describe("jaConvidadas", () => {
  it("lê além das 1.000 linhas que o Supabase devolve por consulta", async () => {
    // A tabela já está em 832 linhas de `plano-completo%`. Passando de 1.000,
    // quem ficasse fora do recorte parecia não-convidada e receberia de novo.
    const linhas = Array.from({ length: 1234 }, (_, i) => ({ user_id: `u${i}` }));
    const { service, historico } = criarService({ email_campaign_sends: paginar(linhas) });

    const set = await jaConvidadas(service);

    expect(set.size).toBe(1234);
    expect(set.has("u0")).toBe(true);
    expect(set.has("u1233")).toBe(true);
    // Sem ORDER BY a fronteira de página é indefinida: a paginação pula linha.
    expect(ordens(historico[0].chamadas)).toEqual(["campaign", "user_id"]);
  });

  it("joga quando a leitura falha, em vez de devolver lista vazia", async () => {
    // Era o pior caminho: erro engolido virava "ninguém foi convidada ainda",
    // e o convite saía outra vez para as 752 alunas já convidadas.
    const { service } = criarService({
      email_campaign_sends: () => ({ data: null, error: { message: "timeout" } }),
    });

    // Só checa que joga: o texto do motivo se perde no caminho, porque o erro
    // do PostgREST é objeto puro e `fetchAll` o transforma em "[object Object]".
    // Isso é de `src/lib/supabase/fetch-all.ts`, que não é deste conserto.
    await expect(jaConvidadas(service)).rejects.toThrow(/falhou na página/);
  });
});

describe("comPlanoAtivo", () => {
  it("pagina e deixa de fora quem já venceu", async () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString();
    const amanha = new Date(Date.now() + 86_400_000).toISOString();
    const linhas = [
      ...Array.from({ length: 1000 }, (_, i) => ({ user_id: `a${i}`, expires_at: null })),
      { user_id: "vencida", expires_at: ontem },
      { user_id: "vigente", expires_at: amanha },
    ];
    const { service, historico } = criarService({ memberships: paginar(linhas) });

    const set = await comPlanoAtivo(service);

    expect(set.size).toBe(1001);
    expect(set.has("vigente")).toBe(true);
    expect(set.has("vencida")).toBe(false);
    expect(ordens(historico[0].chamadas)).toEqual(["id"]);
  });

  it("joga quando a leitura falha", async () => {
    const { service } = criarService({ memberships: () => ({ data: null, error: { message: "caiu" } }) });
    await expect(comPlanoAtivo(service)).rejects.toThrow(/falhou na página/);
  });
});

describe("matriculasPorAluna", () => {
  it("agrupa as 12 mil matrículas sem perder página", async () => {
    // Uma matrícula perdida derruba a aluna abaixo do mínimo de 4 cursos e ela
    // some do disparo da base.
    const linhas = Array.from({ length: 2500 }, (_, i) => ({
      user_id: `aluna${i % 500}`,
      course_id: `curso${Math.floor(i / 500)}`,
    }));
    const { service, historico } = criarService({ enrollments: paginar(linhas) });

    const porAluna = await matriculasPorAluna(service);

    expect(porAluna.size).toBe(500);
    expect(porAluna.get("aluna0")?.size).toBe(5);
    expect(ordens(historico[0].chamadas)).toEqual(["user_id", "course_id"]);
  });
});

describe("reservarEnvios", () => {
  it("devolve só quem foi reservado AGORA", async () => {
    // Quem já tinha linha não volta no RETURNING do ON CONFLICT DO NOTHING —
    // é assim que a PK (campaign,user_id) vira a trava contra o e-mail repetido.
    const { service, historico } = criarService({
      email_campaign_sends: () => ({ data: [{ user_id: "nova" }], error: null }),
    });

    const reservados = await reservarEnvios(service, "plano-completo-conclusao-1", [
      { user_id: "nova", email: "nova@exemplo.com" },
      { user_id: "jaRecebeu", email: "ja@exemplo.com" },
    ]);

    expect([...reservados]).toEqual(["nova"]);
    const upsert = historico[0].chamadas.find((c) => c.metodo === "upsert")!;
    expect(upsert.args[0]).toEqual([
      { campaign: "plano-completo-conclusao-1", user_id: "nova", email: "nova@exemplo.com" },
      { campaign: "plano-completo-conclusao-1", user_id: "jaRecebeu", email: "ja@exemplo.com" },
    ]);
    expect(upsert.args[1]).toEqual({ onConflict: "campaign,user_id", ignoreDuplicates: true });
  });

  it("joga quando a reserva falha — o e-mail não chega a sair", async () => {
    const { service } = criarService({
      email_campaign_sends: () => ({ data: null, error: { message: "conexão caiu" } }),
    });

    await expect(
      reservarEnvios(service, "plano-completo-base", [{ user_id: "u1", email: "u1@exemplo.com" }])
    ).rejects.toThrow(/plano-completo-base: conexão caiu/);
  });

  it("não chama o banco com fila vazia", async () => {
    const { service, historico } = criarService({});
    expect((await reservarEnvios(service, "plano-completo-base", [])).size).toBe(0);
    expect(historico).toHaveLength(0);
  });
});

describe("desfazerReservas", () => {
  it("apaga só a campanha e os ids da rodada", async () => {
    const { service, historico } = criarService({ email_campaign_sends: () => ({ data: [], error: null }) });

    await desfazerReservas(service, "plano-completo-conclusao-2", ["u1", "u2"]);

    const chamadas = historico[0].chamadas.map((c) => [c.metodo, ...c.args]);
    expect(chamadas).toEqual([
      ["delete"],
      ["eq", "campaign", "plano-completo-conclusao-2"],
      ["in", "user_id", ["u1", "u2"]],
    ]);
  });

  it("não joga se o delete falhar — a aluna perde o convite, não recebe dobrado", async () => {
    const { service } = criarService({
      email_campaign_sends: () => ({ data: null, error: { message: "falhou" } }),
    });
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(desfazerReservas(service, "plano-completo-base", ["u1"])).resolves.toBeUndefined();

    silencio.mockRestore();
  });

  it("não chama o banco sem ids", async () => {
    const { service, historico } = criarService({});
    await desfazerReservas(service, "plano-completo-base", []);
    expect(historico).toHaveLength(0);
  });

  it("fatia em blocos de 300 — o `.in()` viaja na URL", async () => {
    const ids = Array.from({ length: 700 }, (_, i) => `u${i}`);
    const { service, historico } = criarService({ email_campaign_sends: () => ({ data: [], error: null }) });

    await desfazerReservas(service, "plano-completo-base", ids);

    expect(historico).toHaveLength(3);
    const tamanhos = historico.map((h) => (h.chamadas.find((c) => c.metodo === "in")!.args[1] as string[]).length);
    expect(tamanhos).toEqual([300, 300, 100]);
  });
});
