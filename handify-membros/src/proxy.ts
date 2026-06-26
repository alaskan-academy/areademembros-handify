import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/cadastro", "/recuperar-senha", "/nova-senha"];
// /api/ e /auth/ são necessidades técnicas: webhook Payt (server-to-server) e callback OAuth do Supabase.
// Todos os outros prefixos requerem login — acesso 100% fechado sem conta.
const ALWAYS_PUBLIC_PREFIXES = ["/api/", "/auth/"];

function isPublicRoute(pathname: string): boolean {
  if (ALWAYS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Mantém x-pathname para server components lerem o caminho atual
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Response base — pode ser substituída pelo setAll ao renovar cookies
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Cria cliente Supabase com leitura e escrita de cookies no middleware.
  // O setAll é chamado automaticamente quando o access token é renovado.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propaga cookies novos tanto no request quanto na response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Preserva x-pathname ao recriar a response com os novos cookies
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // CRÍTICO: esta chamada renova o access token quando expirado usando o refresh token.
  // Sem ela, o token expira em 1h e o aluno é deslogado automaticamente.
  // Nunca remover nem mover para depois de qualquer lógica condicional.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authenticated = !!user;

  if (isPublicRoute(pathname)) {
    if (authenticated && (pathname === "/login" || pathname === "/cadastro")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.webp|.*\\.gif|.*\\.ico).*)",
  ],
};
