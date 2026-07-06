import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AlunaDetail from "./aluna-detail";
import type { ActivityItem } from "@/components/admin/alunos/ActivityTab";
import { decryptCpf, formatCpf } from "@/lib/cpf-crypto";

export default async function AlunaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/dashboard");

  const [{ userId }, { tab }] = await Promise.all([params, searchParams]);
  const service = createServiceClient();

  // Perfil da aluna
  const { data: profile } = await service
    .from("profiles")
    .select("id, full_name, email, role, banned, created_at, avatar_url, phone, date_of_birth, cpf_encrypted")
    .eq("id", userId)
    .single();

  if (!profile || profile.role === "admin") notFound();

  // Descriptografa CPF server-side para exibição mascarada no admin
  let cpfMasked: string | null = null;
  if ((profile as { cpf_encrypted?: string | null }).cpf_encrypted) {
    try {
      const raw = decryptCpf((profile as { cpf_encrypted: string }).cpf_encrypted);
      const formatted = formatCpf(raw.replace(/\D/g, ""));
      // Mascara os 3 primeiros dígitos: ***.456.789-09
      cpfMasked = formatted.replace(/^\d{3}/, "***");
    } catch {
      cpfMasked = null;
    }
  }

  // Matrículas com curso
  const { data: enrollments } = await service
    .from("enrollments")
    .select(
      "id, source, granted_at, expires_at, course:courses(id, slug, title, thumbnail_url)"
    )
    .eq("user_id", userId)
    .order("granted_at", { ascending: false });

  type EnrollmentRow = {
    id: string;
    source: string;
    granted_at: string;
    expires_at: string | null;
    course: { id: string; slug: string; title: string; thumbnail_url: string | null } | null;
  };

  const enrollmentRows = (enrollments ?? []) as unknown as EnrollmentRow[];

  // Progresso por curso
  const allLessonData: Record<string, { total: number; completed: number }> = {};

  if (enrollmentRows.length > 0) {
    const courseIds = enrollmentRows
      .map((e) => e.course?.id)
      .filter(Boolean) as string[];

    const { data: modules } = await service
      .from("modules")
      .select("course_id, lessons(id, archived)")
      .eq("archived", false)
      .in("course_id", courseIds);

    type LessonRef = { id: string; archived: boolean };
    type ModRow = { course_id: string; lessons: LessonRef[] };
    const modRows = (modules as ModRow[] | null) ?? [];

    const allLessonIds = modRows.flatMap((m) =>
      (m.lessons ?? []).filter((l) => !l.archived).map((l) => l.id)
    );

    if (allLessonIds.length > 0) {
      const { data: progress } = await service
        .from("lesson_progress")
        .select("lesson_id, completed")
        .eq("user_id", userId)
        .in("lesson_id", allLessonIds);

      const completedSet = new Set(
        (progress ?? []).filter((p) => p.completed).map((p) => p.lesson_id)
      );

      const lessonToCourse: Record<string, string> = {};
      for (const m of modRows) {
        for (const l of m.lessons ?? []) {
          if (!l.archived) lessonToCourse[l.id] = m.course_id;
        }
      }

      const totals: Record<string, number> = {};
      const completed: Record<string, number> = {};
      for (const m of modRows) {
        totals[m.course_id] = (totals[m.course_id] ?? 0) +
          (m.lessons ?? []).filter((l) => !l.archived).length;
      }
      for (const lid of allLessonIds) {
        const cid = lessonToCourse[lid];
        if (cid && completedSet.has(lid)) {
          completed[cid] = (completed[cid] ?? 0) + 1;
        }
      }
      for (const cid of courseIds) {
        allLessonData[cid] = {
          total: totals[cid] ?? 0,
          completed: completed[cid] ?? 0,
        };
      }
    } else {
      for (const cid of courseIds) {
        allLessonData[cid] = { total: 0, completed: 0 };
      }
    }
  }

  // Certificados
  const { data: certificates } = await service
    .from("certificates")
    .select("id, verify_hash, issued_at, course:courses(title)")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });

  // Push subscriptions
  const { data: pushSubs } = await service
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  const hasPushEnabled = (pushSubs?.length ?? 0) > 0;

  // Histórico de auditoria
  const { data: auditLog } = await service
    .from("audit_log")
    .select("id, action, target_type, meta, created_at, admin:profiles!admin_id(full_name)")
    .eq("meta->>user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Todos os cursos publicados + enrollment da aluna mesclados
  const { data: allCourses } = await service
    .from("courses")
    .select("id, title, thumbnail_url, slug, product_codes")
    .eq("published", true)
    .order("title");

  // Histórico de compras (payment_events pelo e-mail da aluna)
  const { data: rawPaymentEvents } = await service
    .from("payment_events")
    .select("id, product_code, event_type, processed, error, created_at")
    .eq("buyer_email", profile.email ?? "")
    .order("created_at", { ascending: false })
    .limit(30);

  // Mapeia product_code → título do curso
  type CourseWithCodes = { id: string; title: string; thumbnail_url: string | null; slug: string; product_codes: string[] | null };
  const coursesWithCodes = (allCourses ?? []) as unknown as CourseWithCodes[];

  const paymentEvents = (rawPaymentEvents ?? []).map((pe) => {
    const matched = coursesWithCodes.find((c) =>
      (c.product_codes ?? []).includes(pe.product_code)
    );
    return {
      id: pe.id,
      product_code: pe.product_code as string,
      event_type: pe.event_type as string,
      processed: pe.processed as boolean,
      error: pe.error as string | null,
      created_at: pe.created_at as string,
      course_title: matched?.title ?? null,
    };
  });

  // Activity queries — all in parallel, only need userId
  const [
    { data: actForumPosts },
    { data: actForumComments },
    { data: actSuggestions },
    { data: actLessons },
    { data: actInspLikes },
    { data: actInspBookmarks },
    { data: actInspComments },
  ] = await Promise.all([
    service
      .from("forum_posts")
      .select("id, title, body, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    service
      .from("forum_comments")
      .select("id, body, created_at, post:forum_posts!post_id(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    service
      .from("supplier_suggestions")
      .select("id, name, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    service
      .from("lesson_progress")
      .select("id, updated_at, lesson:lessons!lesson_id(title)")
      .eq("user_id", userId)
      .eq("completed", true)
      .order("updated_at", { ascending: false })
      .limit(50),
    service
      .from("inspiration_likes")
      .select("post_id, created_at, post:inspiration_posts!post_id(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    service
      .from("inspiration_bookmarks")
      .select("post_id, created_at, post:inspiration_posts!post_id(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    service
      .from("inspiration_comments")
      .select("id, body, created_at, post:inspiration_posts!post_id(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  type ForumPostRow = { id: string; title: string | null; body: string | null; created_at: string };
  type ForumCommentRow = { id: string; body: string | null; created_at: string; post: { title: string | null } | null };
  type SuggestionRow = { id: string; name: string | null; status: string | null; created_at: string };
  type LessonProgressRow = { id: string; updated_at: string; lesson: { title: string | null } | null };
  type InspLikeRow = { post_id: string; created_at: string; post: { title: string | null } | null };
  type InspBookmarkRow = { post_id: string; created_at: string; post: { title: string | null } | null };
  type InspCommentRow = { id: string; body: string | null; created_at: string; post: { title: string | null } | null };

  const activityItems: ActivityItem[] = [
    ...((actForumPosts ?? []) as unknown as ForumPostRow[]).map((p) => ({
      id: p.id,
      type: "forum_post" as const,
      content: p.title ?? p.body?.slice(0, 120) ?? "Post no fórum",
      date: p.created_at,
    })),
    ...((actForumComments ?? []) as unknown as ForumCommentRow[]).map((c) => ({
      id: c.id,
      type: "forum_comment" as const,
      content: c.body?.slice(0, 120) ?? "Comentário",
      context: c.post?.title ?? undefined,
      date: c.created_at,
    })),
    ...((actSuggestions ?? []) as unknown as SuggestionRow[]).map((s) => ({
      id: s.id,
      type: "suggestion" as const,
      content: s.name ?? "Sugestão de fornecedor",
      status: s.status ?? undefined,
      date: s.created_at,
    })),
    ...((actLessons ?? []) as unknown as LessonProgressRow[]).map((lp) => ({
      id: lp.id,
      type: "lesson_completed" as const,
      content: lp.lesson?.title ?? "Aula concluída",
      date: lp.updated_at,
    })),
    ...((actInspLikes ?? []) as unknown as InspLikeRow[]).map((l) => ({
      id: `like_${l.post_id}`,
      type: "insp_like" as const,
      content: l.post?.title ?? "Inspiração",
      date: l.created_at,
    })),
    ...((actInspBookmarks ?? []) as unknown as InspBookmarkRow[]).map((b) => ({
      id: `bookmark_${b.post_id}`,
      type: "insp_bookmark" as const,
      content: b.post?.title ?? "Inspiração",
      date: b.created_at,
    })),
    ...((actInspComments ?? []) as unknown as InspCommentRow[]).map((c) => ({
      id: c.id,
      type: "insp_comment" as const,
      content: c.body?.slice(0, 120) ?? "Comentário",
      context: c.post?.title ?? undefined,
      date: c.created_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  type CourseEntry = {
    id: string;
    title: string;
    thumbnail_url: string | null;
    slug: string;
    enrollment: {
      id: string;
      source: string;
      granted_at: string;
      expires_at: string | null;
      progress: { total: number; completed: number } | null;
    } | null;
  };

  const enrollmentByCourseId = Object.fromEntries(
    enrollmentRows
      .filter((e) => e.course?.id)
      .map((e) => [
        e.course!.id,
        {
          id: e.id,
          source: e.source,
          granted_at: e.granted_at,
          expires_at: e.expires_at,
          progress: allLessonData[e.course!.id] ?? null,
        },
      ])
  );

  const courseEntries: CourseEntry[] = coursesWithCodes.map((c) => ({
    id: c.id,
    title: c.title,
    thumbnail_url: c.thumbnail_url,
    slug: c.slug,
    enrollment: enrollmentByCourseId[c.id] ?? null,
  }));

  return (
    <div className="space-y-6">
      {/* Voltar */}
      <Link
        href="/admin/alunos"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Alunas
      </Link>

      <AlunaDetail
        defaultTab={tab === "atividade" ? "atividade" : "perfil"}
        activity={activityItems}
        profile={{
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          banned: profile.banned ?? false,
          created_at: profile.created_at,
          phone: (profile as { phone?: string | null }).phone ?? null,
          date_of_birth: (profile as { date_of_birth?: string | null }).date_of_birth ?? null,
          cpf_masked: cpfMasked,
          hasPushEnabled,
        }}
        courses={courseEntries}
        paymentEvents={paymentEvents}
        certificates={(certificates ?? []) as unknown as {
          id: string;
          verify_hash: string;
          issued_at: string;
          course: { title: string } | null;
        }[]}
        auditLog={(auditLog ?? []) as unknown as {
          id: string;
          action: string;
          meta: Record<string, unknown>;
          created_at: string;
          admin: { full_name: string | null } | null;
        }[]}
      />
    </div>
  );
}
