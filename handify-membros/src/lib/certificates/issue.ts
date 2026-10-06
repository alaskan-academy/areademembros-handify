import "server-only";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { generateCertificatePdf } from "@/lib/certificate";
import { sendCertificateEmail } from "@/lib/email";
import { decryptCpf, formatCpf } from "@/lib/cpf-crypto";

/**
 * Percentual de aulas concluídas que libera o certificado.
 *
 * Era 0.95, que com o arredondamento para cima virava "todas as aulas" em curso
 * curto: 19 aulas pediam 19, 9 pediam 9. A aluna chegava no fim, lia "Parabéns!"
 * e não tinha certificado nenhum.
 *
 * Cuidado com o arredondamento ao mexer aqui: `Math.ceil` faz o percentual valer
 * menos do que parece em curso pequeno. Com 0.90, um curso de 9 aulas continua
 * pedindo as 9 (ceil(8.1) = 9), e um de 8 continua pedindo as 8. O percentual só
 * ganha folga de verdade a partir de ~10 aulas.
 */
const LIMIAR = 0.9;

/**
 * Quantas aulas concluídas o certificado exige, num curso com `total` aulas.
 *
 * Fica exportada e separada do resto porque é a regra que decide quem recebe um
 * documento — e porque o arredondamento engana: ver o comentário de `LIMIAR`.
 */
export function aulasNecessarias(total: number): number {
  return Math.ceil(total * LIMIAR);
}

/**
 * Emite o certificado de um curso para uma aluna, se ela já cumpriu o
 * requisito e ainda não tem.
 *
 * Vive aqui, e não dentro da action da aula, porque dois caminhos precisam
 * dela: a aluna marcando a última aula, e a admin emitindo depois — o caso de
 * ligar `has_certificate` num curso que já tinha concluintes, que de outro
 * modo ficariam sem nada.
 *
 * Usa o cliente de serviço: no caminho da admin não existe sessão da aluna,
 * e a verificação de conclusão é feita aqui mesmo, no servidor.
 *
 * @returns true se emitiu agora; false se já tinha, não cumpriu o requisito,
 *          o curso não dá certificado, ou algo falhou (registrado no log).
 */
export async function issueCertificateIfComplete(
  userId: string,
  courseId: string,
  { enviarEmail = true }: { enviarEmail?: boolean } = {}
): Promise<boolean> {
  const service = createServiceClient();

  const { data: existing } = await service
    .from("certificates")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) return false;

  // Aulas ativas do curso — arquivadas não contam para o total.
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

  if (!lessonIds.length) return false;

  const { count: completedCount } = await service
    .from("lesson_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("completed", true)
    .in("lesson_id", lessonIds);

  const limiar = aulasNecessarias(lessonIds.length);
  if (!limiar || (completedCount ?? 0) < limiar) return false;

  const [{ data: profile }, { data: course }] = await Promise.all([
    service.from("profiles").select("full_name, email, cpf_encrypted").eq("id", userId).single(),
    service
      .from("courses")
      .select("title, workload_hours, has_certificate, course_type")
      .eq("id", courseId)
      .single(),
  ]);

  if (!profile || !course) return false;
  if (!course.has_certificate || course.course_type !== "course") return false;

  let cpfFormatted: string | null = null;
  if (profile.cpf_encrypted) {
    try {
      cpfFormatted = formatCpf(decryptCpf(profile.cpf_encrypted));
    } catch {
      // CPF não é obrigatório no certificado — segue sem ele.
    }
  }

  const verifyHash = crypto.randomUUID();
  const issuedAt = new Date();

  const pdfBytes = await generateCertificatePdf({
    studentName: profile.full_name ?? "Aluna Handify",
    cpf: cpfFormatted,
    courseTitle: course.title,
    workloadHours: course.workload_hours ?? 0,
    issuedAt,
    verifyHash,
  });

  const pdfPath = `${userId}/${verifyHash}.pdf`;

  const { error: uploadError } = await service.storage
    .from("certificates")
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    console.error("[cert] upload error:", uploadError);
    return false;
  }

  const { error: insertError } = await service.from("certificates").insert({
    user_id: userId,
    course_id: courseId,
    verify_hash: verifyHash,
    issued_at: issuedAt.toISOString(),
    pdf_path: pdfPath,
    // O mesmo número que acabou de ser carimbado no PDF acima. Guardado aqui para a
    // página de verificação nunca discordar do documento que a aluna tem na mão.
    workload_hours: course.workload_hours ?? 0,
  });

  if (insertError) {
    console.error("[cert] insert error:", insertError);
    return false;
  }

  if (enviarEmail && profile.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://membros.handify.com.br";
    await sendCertificateEmail({
      to: profile.email,
      studentName: profile.full_name ?? "Aluna",
      courseTitle: course.title,
      profileUrl: `${appUrl}/perfil`,
    }).catch((err) => console.error("[cert] email error:", err));
  }

  return true;
}
