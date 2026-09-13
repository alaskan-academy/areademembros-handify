import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Liga a compra à aluna quando o e-mail digitado no cadastro não é o e-mail da
 * compra.
 *
 * A aluna erra o próprio e-mail com alguma frequência — um "n" a mais, "hormail"
 * no lugar de "hotmail", ".com.com" no fim. Até 12/09/2026 a plataforma só
 * procurava a compra pelo e-mail exato, então nesses casos ela entrava e não via
 * curso nenhum, e a admin resolvia à mão criando uma segunda conta. Sobraram 7
 * alunas pagantes sem acesso e 18 pessoas com conta duplicada.
 *
 * A identidade aqui é **telefone + primeiro nome**, exigindo os dois.
 *
 * Só o telefone não serve: casal e família compartilham número. No caso real de
 * hzpdp@gmail.com (Hemerson) o telefone é o mesmo de hzpdp1969@gmail.com (Hida),
 * e são duas pessoas — se a regra fosse só telefone, os 6 cursos dele cairiam na
 * conta dela. Com o primeiro nome, esse caso é corretamente recusado.
 */

/** Só dígitos, sem o 55 de país. Espelha `public.telefone_comparavel` no banco. */
export function telefoneComparavel(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const digitos = bruto.replace(/\D/g, "");
  // O 55 só sai de número com 12 ou 13 dígitos — comprimento de telefone
  // brasileiro COM código do país. Celular de 11 dígitos em DDD 55 (Santa
  // Maria/RS) continua inteiro.
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return digitos.slice(2);
  }
  return digitos || null;
}

/** Telefone que identifica alguém: DDD + número. Menos que isso não afirma nada. */
export function telefoneUtilizavel(norm: string | null): norm is string {
  return !!norm && norm.length >= 10;
}

/** Sem acento, sem caixa, sem espaço sobrando. */
function normalizaNome(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Mesmo primeiro nome. É o que separa "a aluna errou o e-mail" de "duas pessoas
 * no mesmo telefone" — com tolerância a "Ana Maria" × "Ana", que é o mesmo
 * primeiro nome.
 */
export function mesmoPrimeiroNome(a: string | null | undefined, b: string | null | undefined): boolean {
  const primeiro = (v: string | null | undefined) => normalizaNome(v).split(/\s+/)[0] ?? "";
  const pa = primeiro(a);
  const pb = primeiro(b);
  // Nome de uma letra não identifica ninguém.
  if (pa.length < 2 || pb.length < 2) return false;
  return pa === pb;
}

export type TokenPendente = {
  token: string;
  course_id: string | null;
  email: string;
  buyer_name: string | null;
  transaction_id?: string | null;
};

/**
 * Tira da lista o que veio de compra estornada.
 *
 * `grantPendingEnrollments` sempre concedeu todo token com used=false sem
 * perguntar se o dinheiro continuou na conta. Em 13/09/2026 havia 42 tokens
 * pendentes de e-mails com estorno — bastava a pessoa criar conta para entrar
 * com acesso a uma compra reembolsada. O buraco é antigo, mas ficou maior
 * quando o cadastro passou a achar a compra também pelo telefone.
 *
 * A pergunta é sobre a TRANSAÇÃO: "paid" seguido de estorno na mesma. Um
 * "canceled" de transação que nunca foi paga é PIX abandonado e não conta.
 * Tokens anteriores a 13/09 não guardam a transação, e nesses a checagem olha
 * todas as do e-mail — segura compra boa de vez em quando, e é o lado certo de
 * errar, porque o caso segurado aparece no relatório de compras sem acesso.
 */
export async function semCompraEstornada<T extends TokenPendente>(
  service: SupabaseClient,
  tokens: T[]
): Promise<T[]> {
  if (!tokens.length) return tokens;

  // Uma consulta por par (e-mail, transação) — normalmente um ou dois.
  const pares = new Map<string, { email: string; transacao: string | null }>();
  for (const t of tokens) {
    const email = t.email.toLowerCase();
    const transacao = t.transaction_id ?? null;
    pares.set(`${email}|${transacao ?? ""}`, { email, transacao });
  }

  const estornados = new Set<string>();
  await Promise.all(
    [...pares.entries()].map(async ([chave, { email, transacao }]) => {
      const { data, error } = await service.rpc("compra_estornada", {
        p_email: email,
        p_transaction_id: transacao,
      });
      if (error) {
        // Falha de consulta não pode liberar acesso de compra estornada: na
        // dúvida, segura. O relatório diário levanta o caso.
        console.error("[vincular-compra] compra_estornada falhou:", error.message);
        estornados.add(chave);
        return;
      }
      if (data === true) estornados.add(chave);
    })
  );

  if (!estornados.size) return tokens;

  const mantidos = tokens.filter(
    (t) => !estornados.has(`${t.email.toLowerCase()}|${t.transaction_id ?? ""}`)
  );
  console.warn(
    `[vincular-compra] ${tokens.length - mantidos.length} token(s) retidos por estorno na compra`
  );
  return mantidos;
}

/**
 * Tokens de compra de OUTROS e-mails que pertencem a esta mesma pessoa.
 *
 * `nomeDaConta` é o nome que a aluna informou no cadastro; `emailDaConta` é
 * excluído porque esses tokens já são tratados pelo caminho normal.
 */
export async function compraDeOutroEmail(
  service: SupabaseClient,
  params: { telefone: string | null | undefined; nomeDaConta: string; emailDaConta: string }
): Promise<TokenPendente[]> {
  const telefone = telefoneComparavel(params.telefone);
  if (!telefoneUtilizavel(telefone)) return [];

  const { data, error } = await service
    .from("activation_tokens")
    .select("token, course_id, email, buyer_name, transaction_id")
    .eq("buyer_phone_norm", telefone)
    .eq("used", false)
    .not("course_id", "is", null);

  if (error) {
    // Nunca derruba o cadastro por causa disto: a aluna precisa conseguir entrar.
    console.error("[vincular-compra] erro ao buscar por telefone:", error.message);
    return [];
  }

  const emailDaConta = params.emailDaConta.toLowerCase();
  const daMesmaPessoa = (data ?? []).filter(
    (t) =>
      t.email?.toLowerCase() !== emailDaConta &&
      mesmoPrimeiroNome(t.buyer_name, params.nomeDaConta)
  ) as TokenPendente[];

  return semCompraEstornada(service, daMesmaPessoa);
}

/**
 * Conta já existente que é da mesma pessoa desta compra.
 *
 * Usada pelo webhook quando o e-mail da compra não tem conta: em vez de mandar
 * um e-mail de ativação para um endereço que não existe, matricula na conta que
 * a aluna já usa.
 */
export async function contaDaMesmaPessoa(
  service: SupabaseClient,
  params: { telefone: string | null | undefined; nomeDoComprador: string | null | undefined }
): Promise<{ id: string; email: string; full_name: string | null } | null> {
  const telefone = telefoneComparavel(params.telefone);
  if (!telefoneUtilizavel(telefone)) return null;
  if (!params.nomeDoComprador) return null;

  const { data, error } = await service
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("phone_norm", telefone)
    .limit(10);

  if (error) {
    console.error("[vincular-compra] erro ao buscar conta por telefone:", error.message);
    return null;
  }

  const candidatas = (data ?? []).filter(
    (p) => p.role !== "admin" && mesmoPrimeiroNome(p.full_name, params.nomeDoComprador)
  );

  // Duas contas com o mesmo telefone E o mesmo primeiro nome: não dá para
  // escolher sozinha. Deixa o fluxo de token seguir e o relatório de compras
  // sem acesso levantar o caso.
  if (candidatas.length !== 1) return null;

  const { id, email, full_name } = candidatas[0];
  return { id, email, full_name };
}
