import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Quem está pedindo, e se é admin.
 *
 * Admin tem acesso a todos os cursos — os de hoje e os que forem criados
 * depois. A regra vive aqui e em `public.is_enrolled()` no banco (usada pelas
 * policies de RLS); as duas precisam concordar.
 *
 * Não criamos matrícula para o admin de propósito: ela entraria nas métricas,
 * na taxa de conclusão e na contagem de alunas, e teria que ser refeita a cada
 * curso novo.
 */
export async function getViewer(): Promise<{ userId: string | null; isAdmin: boolean }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, isAdmin: profile?.role === "admin" };
}

/** A pessoa logada pode assistir este curso? Admin sempre pode. */
export async function hasCourseAccess(courseId: string): Promise<boolean> {
  const { userId, isAdmin } = await getViewer();
  if (!userId) return false;
  if (isAdmin) return true;

  const supabase = await createClient();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  return !!enrollment;
}
