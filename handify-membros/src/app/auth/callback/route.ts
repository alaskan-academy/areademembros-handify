import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "signup" | "email" | "magiclink" | null;
  const next = searchParams.get("next") ?? "/cursos";

  const supabase = await createClient();
  let exchangeError = null;

  if (code) {
    // PKCE flow — code vem do e-mail via resetPasswordForEmail com redirectTo
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeError = error;
  } else if (token_hash && type) {
    // OTP/email flow — token_hash vem quando o Supabase usa email OTP (não PKCE)
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    exchangeError = error;
  }

  if (!exchangeError && (code || token_hash)) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link-expirado`);
}
