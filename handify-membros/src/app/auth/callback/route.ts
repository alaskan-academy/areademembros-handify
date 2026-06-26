import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "signup" | "email" | "magiclink" | null;
  const next = searchParams.get("next") ?? "/cursos";

  if (code || (token_hash && type)) {
    // Cria a response de redirect ANTES do cliente Supabase,
    // para que o setAll() grave os cookies da sessão diretamente nela.
    // Usando createClient() do next/headers os cookies iam para o response
    // interno do Next.js — não para o NextResponse.redirect que retornamos.
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

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
  }

  return NextResponse.redirect(`${origin}/login?error=link-expirado`);
}
