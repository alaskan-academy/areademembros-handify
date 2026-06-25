"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateCertificatePdf } from "@/lib/certificate";
import { sendCertificateEmail } from "@/lib/email";
import { decryptCpf, formatCpf } from "@/lib/cpf-crypto";
import { revalidatePath } from "next/cache";

// ─── Vídeo ────────────────────────────────────────────────────────────────────

export async function getLessonAccess(
  lessonId: string
): Promise<{ hasAccess: boolean; videoId: string | null }> {
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("video_panda_id, is_preview, module:modules(course_id)")
    .eq("id", lessonId)
    .single();

  if (!lesson) return { hasAccess: false, videoId: null };

  // Preserva a URL completa do Panda Video se colada, extrai UUID só se necessário
  const rawId = lesson.video_panda_id?.trim() ?? "";
  const videoId = rawId || null;

  if (lesson.is_preview) return { hasAccess: true, videoId };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { hasAccess: false, videoId: null };

  const mod = lesson.module as unknown as { course_id: string } | null;
  const courseId = mod?.course_id;
  if (!courseId) return { hasAccess: false, videoId: null };

  const now = new Date().toISOString();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();

  return { hasAccess: !!enrollment, videoId: enrollment ? videoId : null };
}

/** @deprecated use getLessonAccess */
export async function getVideoId(lessonId: string): Promise<string | null> {
  const { videoId } = await getLessonAccess(lessonId);
  return videoId;
}

// ─── Progresso ────────────────────────────────────────────────────────────────

// Salva APENAS a posição — nunca toca no campo `completed`
// Usado pelo player a cada 10s e no unmount para não sobrescrever conclusões
export async function savePosition(
  lessonId: string,
  position: number
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      last_position: Math.floor(position),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) console.error("[savePosition] error:", error);
}

export async function unmarkLessonComplete(lessonId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      completed: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) throw new Error("Não foi possível desmarcar a aula. Tente novamente.");

  revalidatePath(`/aulas/${lessonId}`);
  revalidatePath("/dashboard");
}

export async function markLessonComplete(
  lessonId: string
): Promise<{ certificateIssued: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { certificateIssued: false };

  const { error: upsertError } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      completed: true,
      last_position: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (upsertError) {
    console.error("[markLessonComplete] upsert error:", upsertError);
    throw new Error("Não foi possível salvar o progresso. Tente novamente.");
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("module:modules(course_id)")
    .eq("id", lessonId)
    .single();

  const courseId = (lesson?.module as unknown as { course_id: string } | null)
    ?.course_id;

  let certificateIssued = false;
  if (courseId) {
    certificateIssued = await issueCertificateIfComplete(user.id, courseId).catch(
      (err) => {
        console.error("[cert] issueCertificate failed:", err);
        return false;
      }
    );
  }

  revalidatePath(`/aulas/${lessonId}`);
  revalidatePath("/perfil");
  revalidatePath("/dashboard");

  return { certificateIssued };
}

// ─── Materiais ────────────────────────────────────────────────────────────────

export async function getMaterialSignedUrl(
  materialId: string
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Busca o material e verifica matrícula no curso
  const { data: material } = await supabase
    .from("lesson_materials")
    .select("file_path, lesson:lessons(module:modules(course_id))")
    .eq("id", materialId)
    .single();

  if (!material?.file_path) return null;

  const courseId = (
    material.lesson as unknown as { module: { course_id: string } } | null
  )?.module?.course_id;

  if (!courseId) return null;

  const now = new Date().toISOString();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();

  if (!enrollment) return null;

  const { data: signed } = await supabase.storage
    .from("lesson-materials")
    .createSignedUrl(material.file_path, 3600, { download: true });

  return signed?.signedUrl ?? null;
}

// ─── Progresso por curso ──────────────────────────────────────────────────────

export async function getCourseProgress(courseId: string): Promise<{
  completed: number;
  total: number;
  percentage: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { completed: 0, total: 0, percentage: 0 };

  const { data: modules } = await supabase
    .from("modules")
    .select("lessons(id, archived)")
    .eq("course_id", courseId)
    .eq("archived", false);

  type LessonRef = { id: string; archived: boolean };
  const lessonIds =
    modules?.flatMap((m) =>
      ((m.lessons as LessonRef[]) ?? []).filter((l) => !l.archived).map((l) => l.id)
    ) ?? [];

  if (!lessonIds.length) return { completed: 0, total: 0, percentage: 0 };

  const { count: completedCount } = await supabase
    .from("lesson_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("completed", true)
    .in("lesson_id", lessonIds);

  const total = lessonIds.length;
  const completed = completedCount ?? 0;
  const percentage = Math.round((completed / total) * 100);

  return { completed, total, percentage };
}

// ─── Certificado ──────────────────────────────────────────────────────────────

async function issueCertificateIfComplete(
  userId: string,
  courseId: string
): Promise<boolean> {
  const supabase = await createClient();

  // Verifica se já existe certificado
  const { data: existing } = await supabase
    .from("certificates")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) return false;

  // Busca todas as aulas ativas do curso (exclui arquivadas do cálculo)
  const { data: modules } = await supabase
    .from("modules")
    .select("lessons(id, archived)")
    .eq("course_id", courseId)
    .eq("archived", false);

  type LessonRef = { id: string; archived: boolean };
  const lessonIds =
    modules?.flatMap((m) =>
      ((m.lessons as LessonRef[]) ?? []).filter((l) => !l.archived).map((l) => l.id)
    ) ?? [];

  if (!lessonIds.length) return false;

  // Conta aulas concluídas
  const { count: completedCount } = await supabase
    .from("lesson_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("completed", true)
    .in("lesson_id", lessonIds);

  // Emite certificado ao atingir 95% das aulas concluídas (ceil garante >= 95% real)
  const threshold = Math.ceil(lessonIds.length * 0.95);
  if (!threshold || (completedCount ?? 0) < threshold) return false;

  // Busca dados do aluno e do curso (inclui has_certificate para gate)
  const [{ data: profile }, { data: course }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, cpf_encrypted")
      .eq("id", userId)
      .single(),
    supabase
      .from("courses")
      .select("title, workload_hours, has_certificate")
      .eq("id", courseId)
      .single(),
  ]);

  if (!profile || !course) return false;
  if (!course.has_certificate) return false;

  // Descriptografa CPF se disponível
  let cpfFormatted: string | null = null;
  if (profile.cpf_encrypted) {
    try {
      cpfFormatted = formatCpf(decryptCpf(profile.cpf_encrypted));
    } catch {
      // CPF não crítico — prossegue sem ele
    }
  }

  // Gera hash único
  const verifyHash = crypto.randomUUID();
  const issuedAt = new Date();

  // Gera PDF
  const pdfBytes = await generateCertificatePdf({
    studentName: profile.full_name ?? "Aluna Handify",
    cpf: cpfFormatted,
    courseTitle: course.title,
    workloadHours: course.workload_hours ?? 0,
    issuedAt,
    verifyHash,
  });

  // Faz upload para Storage usando service role
  const serviceClient = createServiceClient();
  const pdfPath = `${userId}/${verifyHash}.pdf`;

  const { error: uploadError } = await serviceClient.storage
    .from("certificates")
    .upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("[cert] upload error:", uploadError);
    return false;
  }

  // Registra certificado no banco
  const { error: insertError } = await serviceClient
    .from("certificates")
    .insert({
      user_id: userId,
      course_id: courseId,
      verify_hash: verifyHash,
      issued_at: issuedAt.toISOString(),
      pdf_path: pdfPath,
    });

  if (insertError) {
    console.error("[cert] insert error:", insertError);
    return false;
  }

  // Envia e-mail de parabéns
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://membros.handify.com.br";
  await sendCertificateEmail({
    to: profile.email,
    studentName: profile.full_name ?? "Aluna",
    courseTitle: course.title,
    profileUrl: `${appUrl}/perfil`,
  }).catch((err) => console.error("[cert] email error:", err));

  return true;
}
