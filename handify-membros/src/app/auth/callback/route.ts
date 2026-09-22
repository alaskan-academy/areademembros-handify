import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "signup" | "email" | "magiclink" | null;
  // Supabase não preserva query params do redirectTo no flow OTP (token_hash).
  // Se type=recovery, sempre vai para /nova-senha independente do next param.
  const next = type === "recovery" ? "/nova-senha" : (searchParams.get("next") ?? "/cursos");

  // Guardados antes de qualquer troca de sessão: o resgate lá embaixo precisa
  // dos cookies exatamente como chegaram.
  const cookiesDaEntrada = request.cookies.getAll();

  // Cliente que grava os cookies da sessão direto na response que devolvemos.
  // Usando createClient() do next/headers eles iam para o response interno do
  // Next.js — não para o NextResponse.redirect que retornamos.
  function clienteQueGravaEm(response: NextResponse) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookiesDaEntrada;
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
  }

  if (code || (token_hash && type)) {
    const response = NextResponse.redirect(`${origin}${next}`);
    const supabase = clienteQueGravaEm(response);

    let exchangeError = null;

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      exchangeError = error;
    } else if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type });
      exchangeError = error;
    }

    if (!exchangeError) {
      return response; // response já carrega os cookies da sessão
    }

    // Link de uso único aberto duas vezes não é link expirado.
    //
    // O token do e-mail vale uma vez. Quando ela abre de novo — voltou, deu
    // refresh, o PWA reabriu o link, ou o antivírus do provedor abriu antes
    // dela — o Supabase responde "One-time token not found" e caíamos direto no
    // login, apagando o caminho de quem já tinha a sessão certa no navegador.
    //
    // Aconteceu em 21/09/2026: uma aluna teve /verify 200 às 19:01 e /verify
    // 403 às 19:02. A sessão estava lá o tempo todo; ela foi para o login
    // assim mesmo, e o login nem dizia por quê. Se a sessão existe, o destino
    // do link continua valendo.
    const resgate = NextResponse.redirect(`${origin}${next}`);
    const {
      data: { user },
    } = await clienteQueGravaEm(resgate).auth.getUser();

    if (user) {
      return resgate;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link-expirado`);
}
