"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { issueCertificateIfComplete } from "@/lib/certificates/issue";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticada");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") throw new Error("Sem permissão");
}

/**
 * Quantas alunas já cumpriram o requisito deste curso mas estão sem certificado.
 *
 * Serve para o caso de ligar `has_certificate` num curso que já tinha
 * concluintes: elas não recebem nada sozinhas, porque o certificado só é
 * emitido no momento em que uma aula é marcada como concluída.
 */
export async function contarCertificadosPendentes(courseId: string): Promise<number> {
  await assertAdmin();
  return (await alunasSemCertificado(courseId)).length;
}

/** Emite os certificados que faltam. Devolve quantos foram emitidos. */
export async function emitirCertificadosPendentes(
  courseId: string,
  { enviarEmail = true }: { enviarEmail?: boolean } = {}
): Promise<{ emitidos: number; falharam: number }> {
  await assertAdmin();

  const pendentes = await alunasSemCertificado(courseId);

  let emitidos = 0;
  let falharam = 0;

  // Em série de propósito: cada emissão gera um PDF, sobe para o Storage e
  // dispara um e-mail. Em paralelo isso vira um pico desnecessário.
  for (const userId of pendentes) {
    const ok = await issueCertificateIfComplete(userId, courseId, { enviarEmail }).catch(
      (err) => {
        console.error("[cert] emissão retroativa falhou:", userId, err);
        return false;
      }
    );
    if (ok) emitidos++;
    else falharam++;
  }

  revalidatePath("/admin/cursos");
  revalidatePath("/admin/metricas/certificados");

  return { emitidos, falharam };
}

/** Ids das alunas com o curso concluído (≥95%) e sem certificado emitido. */
async function alunasSemCertificado(courseId: string): Promise<string[]> {
  const service = createServiceClient();

  const { data: course } = await service
    .from("courses")
    .select("has_certificate, course_type")
    .eq("id", courseId)
    .single();

  if (!course?.has_certificate || course.course_type !== "course") return [];

  const { data: modules } = await service
    .from("modules")
    .select("lessons(id, archived)")
    .eq("course_id", courseId)
    .eq("archived", false);

  type LessonRef = { id: string; archived: boolean };
  const lessonIds =
    modules?.flatMap((m) =>
      ((m.lessons as LessonRef[]) ?? []).filter((l) => !l.archived).map((l) => l.id)
    ) ?? [];

  if (!lessonIds.length) return [];

  const limiar = Math.ceil(lessonIds.length * 0.95);

  const [matriculas, progresso, certificados] = await Promise.all([
    fetchAll<{ user_id: string }>((de, ate) =>
      service
        .from("enrollments")
        .select("user_id")
        .eq("course_id", courseId)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .range(de, ate)
    ),
    fetchAll<{ user_id: string }>((de, ate) =>
      service
        .from("lesson_progress")
        .select("user_id")
        .eq("completed", true)
        .in("lesson_id", lessonIds)
        .range(de, ate)
    ),
    fetchAll<{ user_id: string }>((de, ate) =>
      service.from("certificates").select("user_id").eq("course_id", courseId).range(de, ate)
    ),
  ]);

  const feitasPorAluna = new Map<string, number>();
  for (const { user_id } of progresso) {
    feitasPorAluna.set(user_id, (feitasPorAluna.get(user_id) ?? 0) + 1);
  }

  const jaTem = new Set(certificados.map((c) => c.user_id));

  return [...new Set(matriculas.map((m) => m.user_id))].filter(
    (userId) => !jaTem.has(userId) && (feitasPorAluna.get(userId) ?? 0) >= limiar
  );
}
