import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendReengagementEmail } from "@/lib/email";

// Vercel Cron: roda diariamente às 10h BRT (13h UTC)
// vercel.json crons: [{ "path": "/api/cron/reengagement", "schedule": "0 13 * * *" }]

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const service = createServiceClient();
    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Matrículas ativas
    const { data: enrollments } = await service
      .from("enrollments")
      .select("user_id, course_id")
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (!enrollments?.length) return NextResponse.json({ sent: 0 });

    let sent = 0;

    for (const { user_id, course_id } of enrollments) {
      // Perfil e preferências
      const { data: profile } = await service
        .from("profiles")
        .select("full_name, email, email_prefs")
        .eq("id", user_id)
        .maybeSingle();

      if (!profile?.email) continue;
      const prefs = profile.email_prefs as Record<string, boolean> | null;
      if (prefs?.reengagement === false) continue;

      // Aulas do curso
      const { data: modules } = await service
        .from("modules")
        .select("id")
        .eq("course_id", course_id);

      if (!modules?.length) continue;

      const { data: lessons } = await service
        .from("lessons")
        .select("id")
        .in("module_id", modules.map((m) => m.id));

      if (!lessons?.length) continue;

      const lessonIds = lessons.map((l) => l.id);

      // Progresso da aluna neste curso
      const { data: progress } = await service
        .from("lesson_progress")
        .select("lesson_id, completed, updated_at")
        .eq("user_id", user_id)
        .in("lesson_id", lessonIds);

      if (!progress?.length) continue; // nunca acessou

      // Verificar se acessou nos últimos 7 dias
      const recentAccess = progress.some((p) => p.updated_at >= sevenDaysAgo);
      if (recentAccess) continue;

      // Verificar se já concluiu
      const completedCount = progress.filter((p) => p.completed).length;
      const pct = (completedCount / lessonIds.length) * 100;
      if (pct >= 100) continue;

      // Dados do curso
      const { data: course } = await service
        .from("courses")
        .select("title, slug")
        .eq("id", course_id)
        .maybeSingle();

      if (!course) continue;

      await sendReengagementEmail({
        to: profile.email,
        studentName: profile.full_name ?? "Aluna",
        courseTitle: course.title,
        courseSlug: course.slug,
        progressPercent: pct,
      });

      sent++;
    }

    console.info(`[cron/reengagement] ${sent} e-mails enviados`);
    return NextResponse.json({ sent });
  } catch (e) {
    console.error("[cron/reengagement]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
