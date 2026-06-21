import { NextRequest, NextResponse } from "next/server";
import { validateEmbedToken } from "@/lib/embed-token";

// Endpoint público para sites externos validarem o token
// GET /api/embed-token?token=xxx
// Response: { email: "..." } ou { error: "..." } com status 401
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token ausente" }, { status: 400 });
  }

  const result = validateEmbedToken(token);

  if (!result) {
    return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 401 });
  }

  return NextResponse.json({ email: result.email });
}
