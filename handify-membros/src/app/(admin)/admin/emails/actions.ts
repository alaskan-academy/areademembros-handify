"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  sendWelcomeEmail,
  sendAccessConfirmedEmail,
  sendCertificateEmail,
  sendReengagementEmail,
  sendNewCourseEmail,
  sendNewsPostEmail,
  sendRefundEmail,
} from "@/lib/email";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Não autorizado");
  return user;
}

export async function sendTestEmail(
  type: string,
  to: string
): Promise<{ error?: string; success?: string }> {
  await assertAdmin();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://membros.handify.com.br";

  try {
    switch (type) {
      case "welcome":
        await sendWelcomeEmail({ to, studentName: "Ana Teste" });
        break;
      case "access":
        await sendAccessConfirmedEmail({
          to,
          studentName: "Ana Teste",
          courseTitle: "Crochê para Iniciantes",
          courseSlug: "croche-para-iniciantes",
        });
        break;
      case "certificate":
        await sendCertificateEmail({
          to,
          studentName: "Ana Teste",
          courseTitle: "Crochê para Iniciantes",
          profileUrl: `${appUrl}/perfil`,
        });
        break;
      case "reengagement":
        await sendReengagementEmail({
          to,
          studentName: "Ana Teste",
          courseTitle: "Macramê do Zero",
          courseSlug: "macrame-do-zero",
          progressPercent: 45,
        });
        break;
      case "new_course":
        await sendNewCourseEmail({
          to,
          studentName: "Ana Teste",
          courseTitle: "Bordado Japonês Sashiko",
          courseSlug: "bordado-japones-sashiko",
          courseDescription: "Aprenda a técnica milenar japonesa de bordado geométrico.",
        });
        break;
      case "news_post":
        await sendNewsPostEmail({
          to,
          studentName: "Ana Teste",
          postTitle: "Desafio de Maio já está aberto!",
          postBody: "Este mês o desafio da comunidade é criar uma peça usando apenas linha de algodão.",
          postId: "test-id",
        });
        break;
      case "refund":
        await sendRefundEmail({
          to,
          studentName: "Ana Teste",
          courseTitle: "Crochê para Iniciantes",
        });
        break;
      default:
        return { error: "Tipo de e-mail inválido" };
    }
    return { success: `E-mail "${type}" enviado para ${to}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao enviar" };
  }
}
