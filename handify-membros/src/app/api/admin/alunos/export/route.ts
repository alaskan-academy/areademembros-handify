import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, email, created_at, banned")
    .neq("role", "admin")
    .order("created_at", { ascending: false });

  if (!profiles?.length) {
    return csvResponse("Nome,E-mail,Qtd. Cursos,Cursos,Aulas Concluídas,Progresso Médio (%),Certificados,Última Atividade,Data de Cadastro,Status\n");
  }

  const profileIds = profiles.map((p) => p.id);

  // ── 2. Matrículas + cursos ──────────────────────────────────
  const { data: enrollments } = await service
    .from("enrollments")
    .select("user_id, granted_at, course_id, source, course:courses(id, title, price)")
    .in("user_id", profileIds);

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

  const { data: lessons } = courseIds.length
    ? await service
        .from("lessons")
        .select("id, module:modules!inner(course_id)")
        .eq("archived", false)
        .in("modules.course_id", courseIds)
    : { data: [] };

  type LessonRow = { id: string; module: { course_id: string } };
  const lessonRows = (lessons ?? []) as unknown as LessonRow[];

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
  const { data: progress } = allLessonIds.length
    ? await service
        .from("lesson_progress")
        .select("user_id, lesson_id, completed, updated_at")
        .in("user_id", profileIds)
        .in("lesson_id", allLessonIds)
    : { data: [] };

  type ProgressRow = { user_id: string; lesson_id: string; completed: boolean; updated_at: string };
  const progressRows = (progress ?? []) as unknown as ProgressRow[];

  // Agrupa progresso por usuário
  const completedByUser: Record<string, Set<string>> = {};
  const lastActivityByUser: Record<string, string> = {};
  for (const p of progressRows) {
    if (p.completed) {
      if (!completedByUser[p.user_id]) completedByUser[p.user_id] = new Set();
      completedByUser[p.user_id].add(p.lesson_id);
    }
    if (!lastActivityByUser[p.user_id] || p.updated_at > lastActivityByUser[p.user_id]) {
      lastActivityByUser[p.user_id] = p.updated_at;
    }
  }

  // ── 5. Certificados ─────────────────────────────────────────
  const { data: certs } = await service
    .from("certificates")
    .select("user_id")
    .in("user_id", profileIds);

  const certCountByUser: Record<string, number> = {};
  for (const c of certs ?? []) {
    certCountByUser[c.user_id] = (certCountByUser[c.user_id] ?? 0) + 1;
  }

  // ── 6. Monta CSV ────────────────────────────────────────────
  const escape = (s: string | number) =>
    `"${String(s ?? "").replace(/"/g, '""')}"`;

  const header = [
    "Nome", "E-mail", "Qtd. Cursos", "Cursos",
    "Aulas Concluídas", "Progresso Médio (%)",
    "Certificados", "Última Atividade",
    "Data de Cadastro", "Status",
  ].join(",");

  const rows = profiles.map((p) => {
    const myEnrolls = enrollRows.filter((e) => e.user_id === p.id);
    const myCourseIds = myEnrolls.map((e) => e.course_id).filter(Boolean);
    const courseTitles = myEnrolls.map((e) => e.course?.title ?? "").filter(Boolean).join("; ");

    // Progresso médio
    const completedLessons = completedByUser[p.id] ?? new Set<string>();
    const totalLessons = myCourseIds.reduce((acc, cid) => acc + (totalByCourse[cid] ?? 0), 0);

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
      ? new Date(lastActivityByUser[p.id]).toLocaleDateString("pt-BR")
      : "Nunca";

    return [
      escape(p.full_name ?? ""),
      escape(p.email ?? ""),
      escape(myEnrolls.length),
      escape(courseTitles),
      escape(completedLessons.size),
      escape(avgProgress),
      escape(certCountByUser[p.id] ?? 0),
      escape(lastActivity),
      escape(new Date(p.created_at).toLocaleDateString("pt-BR")),
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
