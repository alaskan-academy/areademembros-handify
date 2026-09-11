import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/cadastro", "/recuperar-senha", "/nova-senha", "/ativar", "/comecar"];
// /api/ e /auth/ são necessidades técnicas: webhook Payt (server-to-server) e callback OAuth do Supabase.
// /ebooks/ contém materiais estáticos de aula (HTML sem dados de usuário) — precisam abrir em novo tab sem auth.
// Todos os outros prefixos requerem login — acesso 100% fechado sem conta.
const ALWAYS_PUBLIC_PREFIXES = ["/api/", "/auth/", "/ebooks/", "/~offline"];

function isPublicRoute(pathname: string): boolean {
  if (ALWAYS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Marca que já mandamos esta visita de /login para /dashboard uma vez. */
const COOKIE_QUEBRA_LOOP = "hf-auth-bounce";

/**
 * Apaga os cookies de sessão do Supabase. O nome é `sb-<ref>-auth-token`, e
 * quando o token é grande ele vem partido em `.0`, `.1` — por isso o teste é
 * por prefixo e não por nome exato.
 */
function limpaCookiesDeSessao(request: NextRequest, response: NextResponse) {
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith("sb-") && name.includes("-auth-token")) {
      response.cookies.set(name, "", { maxAge: 0, path: "/" });
    }
  }
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

  // getSession() valida o JWT localmente (sem chamada de rede ao Supabase) e
  // renova o access token via refresh token quando expirado — disparando setAll()
  // para gravar os novos cookies na response. Usar getUser() aqui causaria uma
  // chamada de rede por request, atingindo o rate limit rapidamente.
  // getUser() deve ser usado apenas em Server Actions e route handlers sensíveis.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const authenticated = !!session?.user;

  if (isPublicRoute(pathname)) {
    if (authenticated && (pathname === "/login" || pathname === "/cadastro")) {
      // Quebra-loop. O middleware usa getSession(), que só decodifica o JWT
      // localmente; as páginas usam getUser(), que pergunta ao Supabase. Quando
      // a sessão é revogada no servidor (troca de senha, logout em outro
      // aparelho), o token continua decodificando aqui por até uma hora — então
      // o middleware diz "logada" e manda para /dashboard, o layout diz "não
      // logada" e manda para /login, e o navegador morre em
      // ERR_TOO_MANY_REDIRECTS. A aluna fica fora do ar, não só sem sessão.
      //
      // Na segunda passagem seguida, deixamos /login renderizar e apagamos os
      // cookies de sessão — assim ela entra de novo e o estado fica limpo.
      if (request.cookies.get(COOKIE_QUEBRA_LOOP)) {
        response.cookies.delete(COOKIE_QUEBRA_LOOP);
        limpaCookiesDeSessao(request, response);
        return response;
      }
      const paraDashboard = NextResponse.redirect(new URL("/dashboard", request.url));
      paraDashboard.cookies.set(COOKIE_QUEBRA_LOOP, "1", {
        maxAge: 10,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      return paraDashboard;
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
    // worker-*.js e fallback-*.js são carregados por importScripts() de dentro do
    // sw.js durante o install do service worker. Sem esta exclusão o middleware
    // redireciona para /login, o install falha e o Android recusa instalar o app —
    // mesma causa que já tinha derrubado /~offline.
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js|worker-.*\\.js|fallback-.*\\.js|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.webp|.*\\.gif|.*\\.ico).*)",
  ],
};
