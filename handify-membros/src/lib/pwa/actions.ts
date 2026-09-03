"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Marca que a aluna ja tem o app instalado.
 *
 * Chamado em dois momentos: quando ela abre a plataforma pelo icone da tela
 * inicial (o navegador reporta `display-mode: standalone`), e quando ela toca
 * em "Ja instalei" na tarja.
 *
 * Existe porque no iPhone nao ha evento nem API que diga se o app esta na tela
 * inicial — sem esse registro, a tarja continuaria convidando a instalar quem
 * ja instalou. Como fica no perfil e nao no navegador, vale para qualquer
 * aparelho da mesma conta (no iOS o app instalado tem armazenamento separado
 * do Safari, entao localStorage nao resolveria).
 */
export async function registrarAppInstalado(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // `.is(null)` mantem a data da primeira vez e evita escrever a cada page view.
  await supabase
    .from("profiles")
    .update({ app_installed_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("app_installed_at", null);
}
