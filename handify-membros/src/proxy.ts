import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/cadastro", "/recuperar-senha", "/nova-senha"];
const ALWAYS_PUBLIC_PREFIXES = ["/p/", "/verificar/", "/vitrine", "/cursos", "/api/"];

function isPublicRoute(pathname: string): boolean {
  if (ALWAYS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function hasSession(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    ({ name }) => name.startsWith("sb-") && name.endsWith("-auth-token")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = hasSession(request);

  // Repassa o pathname para server components via header de request
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (isPublicRoute(pathname)) {
    if (authenticated && (pathname === "/login" || pathname === "/cadastro")) {
      return NextResponse.redirect(new URL("/cursos", request.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.webp|.*\\.gif|.*\\.ico).*)",
  ],
};
