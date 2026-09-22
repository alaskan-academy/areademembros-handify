import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAll } from "@/lib/supabase/fetch-all";

// Paginar 31 mil linhas de progresso são ~32 idas ao banco, e o padrão da
// Vercel é 10 s. Sem este teto o download morre no meio e a admin recebe um
// erro no lugar da planilha — os crons pesados já declaram o deles.
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (me?.role !== "admin")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const service = createServiceClient();

  // ── 1. Alunas ──────────────────────────────────────────────
  // As SEIS consultas abaixo sao paginadas com fetchAll e ordenadas por id.
  // O Supabase corta em 1.000 linhas sem avisar, e paginar por OFFSET sem
  // ORDER BY pula ou repete linha entre as paginas — lesson_progress e escrita
  // a cada 10s por quem esta assistindo, entao as paginas se mexem debaixo da
  // consulta. Como este CSV cruza as tabelas em memoria, qualquer um dos dois
  // faz "Qtd. Cursos", "Progresso Medio", "Aulas Concluidas" e "Ultima
  // Atividade" mentirem — e a linha pulada nao deixa numero redondo para
  // denunciar. Hoje: 4.558 perfis, 12.002 matriculas, 31.886 linhas de
  // progresso, 210 aulas.
  const profiles = await fetchAll<{
    id: string; full_name: string | null; email: string | null; phone: string | null;
    date_of_birth: string | null; created_at: string; banned: boolean;
  }>((de, ate) =>
    service
      .from("profiles")
      .select("id, full_name, email, phone, date_of_birth, created_at, banned")
      .neq("role", "admin")
      .order("created_at", { ascending: false })
      .order("id")
      .range(de, ate)
  );

  if (!profiles.length) {
    return csvResponse("Nome,E-mail,Telefone,Nascimento,Qtd. Cursos,Cursos,Fonte,Data da 1ª Matrícula,Aulas Concluídas,Progresso Médio (%),Certificados,Última Atividade,Data de Cadastro,Handify Completo,Status\n");
  }

  // As consultas abaixo nao filtram por lista de user_id de proposito. Mandar
  // os 4.558 UUIDs das alunas em `.in(...)` dava ~178 KB de query string, e com
  // a paginacao isso ia reenviado em cada uma das ~46 requisicoes — porta aberta
  // para 414 no gateway. O filtro so servia para tirar 16 linhas do proprio
  // perfil admin, e essas 16 nunca sao lidas: todo mapa daqui para baixo e
  // consultado por `p.id` vindo de `profiles`, que ja exclui admin.

  // Quem tem o Handify Completo ativo (membership, não soma de cursos).
  const membershipRows = await fetchAll<{ user_id: string }>((de, ate) =>
    service
      .from("memberships")
      .select("user_id")
      .eq("plan", "completo")
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("id")
      .range(de, ate)
  );
  const temCompleto = new Set(membershipRows.map((m) => m.user_id));

  // ── 2. Matrículas + cursos ──────────────────────────────────
  const enrollments = await fetchAll((de, ate) =>
    service
      .from("enrollments")
      .select("user_id, granted_at, course_id, source, course:courses(id, title, price)")
      .order("id")
      .range(de, ate)
  );

  type EnrollRow = {
    user_id: string;
    granted_at: string;
    course_id: string;
    source: string;
    course: { id: string; title: string; price: number | null } | null;
  };
  const enrollRows = (enrollments ?? []) as unknown as EnrollRow[];

  // ── 3. Aulas — total por curso ──────────────────────────────
  const courseIds = [...new Set(enrollRows.map((e) => e.course_id).filter(Boolean))];

  // Esta era a unica das seis que ficou crua quando as outras foram paginadas.
  // Hoje sao 210 aulas e o teto de 1.000 nao morde; passando disso, sem aviso,
  // `totalByCourse` e `lessonToCourse` viriam pela metade e "Progresso Medio",
  // "Aulas Concluidas" e "Ultima Atividade" voltariam a mentir.
  const lessons = courseIds.length
    ? await fetchAll((de, ate) =>
        service
          .from("lessons")
          .select("id, module:modules!inner(course_id)")
          .eq("archived", false)
          .in("modules.course_id", courseIds)
          .order("id")
          .range(de, ate)
      )
    : [];

  type LessonRow = { id: string; module: { course_id: string } };
  const lessonRows = lessons as unknown as LessonRow[];

  const totalByCourse: Record<string, number> = {};
  const lessonToCourse: Record<string, string> = {};
  for (const l of lessonRows) {
    const cid = l.module?.course_id;
    if (cid) {
      totalByCourse[cid] = (totalByCourse[cid] ?? 0) + 1;
      lessonToCourse[l.id] = cid;
    }
  }

  // ── 4. Progresso das alunas ─────────────────────────────────
  const allLessonIds = lessonRows.map((l) => l.id);
  const progress = allLessonIds.length
    ? await fetchAll((de, ate) =>
        service
          .from("lesson_progress")
          .select("user_id, lesson_id, completed, updated_at")
          .order("id")
          .range(de, ate)
      )
    : [];

  type ProgressRow = { user_id: string; lesson_id: string; completed: boolean; updated_at: string };
  const progressRows = progress as unknown as ProgressRow[];

  // Agrupa progresso por usuário
  const completedByUser: Record<string, Set<string>> = {};
  const lastActivityByUser: Record<string, string> = {};
  for (const p of progressRows) {
    // Faz em memoria o que o `.in("lesson_id", allLessonIds)` fazia na URL: so
    // conta aula ativa de curso matriculado. Sem esta linha, aula arquivada
    // voltaria a somar em "Aulas Concluidas" e "Ultima Atividade".
    if (!lessonToCourse[p.lesson_id]) continue;
    if (p.completed) {
      if (!completedByUser[p.user_id]) completedByUser[p.user_id] = new Set();
      completedByUser[p.user_id].add(p.lesson_id);
    }
    if (!lastActivityByUser[p.user_id] || p.updated_at > lastActivityByUser[p.user_id]) {
      lastActivityByUser[p.user_id] = p.updated_at;
    }
  }

  // ── 5. Certificados ─────────────────────────────────────────
  const certs = await fetchAll<{ user_id: string }>((de, ate) =>
    service.from("certificates").select("user_id").order("id").range(de, ate)
  );

  const certCountByUser: Record<string, number> = {};
  for (const c of certs) {
    certCountByUser[c.user_id] = (certCountByUser[c.user_id] ?? 0) + 1;
  }

  // ── 6. Monta CSV ────────────────────────────────────────────
  const escape = (s: string | number) =>
    `"${String(s ?? "").replace(/"/g, '""')}"`;

  const header = [
    "Nome", "E-mail", "Telefone", "Nascimento",
    "Qtd. Cursos", "Cursos", "Fonte", "Data da 1ª Matrícula",
    "Aulas Concluídas", "Progresso Médio (%)",
    "Certificados", "Última Atividade",
    "Data de Cadastro", "Handify Completo", "Status",
  ].join(",");

  const rows = (profiles as Array<{
    id: string; full_name: string | null; email: string | null;
    phone: string | null; date_of_birth: string | null;
    created_at: string; banned: boolean | null;
  }>).map((p) => {
    const myEnrolls = enrollRows.filter((e) => e.user_id === p.id);
    const myCourseIds = myEnrolls.map((e) => e.course_id).filter(Boolean);
    const courseTitles = myEnrolls.map((e) => e.course?.title ?? "").filter(Boolean).join("; ");

    // Fonte da matrícula (prioriza 'payt' se houver, senão mostra todas únicas)
    const sources = [...new Set(myEnrolls.map((e) => e.source))];
    const sourceLabel = sources.map((s) =>
      s === "payt" ? "Payt" : s === "manual" ? "Manual" : s === "subscription" ? "Assinatura" : s
    ).join("; ");

    // Data da primeira matrícula
    const firstEnrollAt = myEnrolls
      .map((e) => e.granted_at)
      .sort()
      .at(0);

    // Progresso médio
    const completedLessons = completedByUser[p.id] ?? new Set<string>();

    let avgProgress = 0;
    if (myCourseIds.length > 0) {
      const perCourse = myCourseIds.map((cid) => {
        const total = totalByCourse[cid] ?? 0;
        if (total === 0) return 0;
        const done = lessonRows
          .filter((l) => l.module?.course_id === cid && completedLessons.has(l.id))
          .length;
        return Math.round((done / total) * 100);
      });
      avgProgress = Math.round(perCourse.reduce((a, b) => a + b, 0) / perCourse.length);
    }

    const lastActivity = lastActivityByUser[p.id]
      ? new Date(lastActivityByUser[p.id]).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "Nunca";

    return [
      escape(p.full_name ?? ""),
      escape(p.email ?? ""),
      escape(p.phone ?? ""),
      escape(p.date_of_birth
        ? new Date(p.date_of_birth + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
        : ""),
      escape(myEnrolls.length),
      escape(courseTitles),
      escape(sourceLabel),
      escape(firstEnrollAt ? new Date(firstEnrollAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""),
      escape(completedLessons.size),
      escape(avgProgress),
      escape(certCountByUser[p.id] ?? 0),
      escape(lastActivity),
      escape(new Date(p.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })),
      escape(temCompleto.has(p.id) ? "Sim" : "Não"),
      escape(p.banned ? "Banida" : "Ativa"),
    ].join(",");
  });

  return csvResponse([header, ...rows].join("\n"));
}

function csvResponse(content: string) {
  const bom = "﻿";
  return new Response(bom + content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alunas-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
