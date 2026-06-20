import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  // Verifica autenticação e role admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const service = createServiceClient();

  // Busca todas as alunas (exceto admins)
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, email, created_at, banned")
    .neq("role", "admin")
    .order("created_at", { ascending: false });

  if (!profiles?.length) {
    return new Response("Nome,E-mail,Matrículas,Data de cadastro,Status\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="alunas-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  // Busca matrículas
  const profileIds = profiles.map((p) => p.id);
  const { data: enrollments } = await service
    .from("enrollments")
    .select("user_id, granted_at, course:courses(title)")
    .in("user_id", profileIds);

  type EnrollRow = {
    user_id: string;
    granted_at: string;
    course: { title: string } | null;
  };

  const enrollMap: Record<string, { title: string; date: string }[]> = {};
  for (const e of (enrollments ?? []) as unknown as EnrollRow[]) {
    if (!enrollMap[e.user_id]) enrollMap[e.user_id] = [];
    enrollMap[e.user_id].push({
      title: e.course?.title ?? "",
      date: new Date(e.granted_at).toLocaleDateString("pt-BR"),
    });
  }

  // Gera CSV
  const escape = (s: string) =>
    `"${(s ?? "").replace(/"/g, '""')}"`;

  const header = "Nome,E-mail,Matrículas,Data de cadastro,Status";
  const rows = profiles.map((p) => {
    const courses = (enrollMap[p.id] ?? []).map((e) => e.title).join("; ");
    const status = p.banned ? "Banida" : "Ativa";
    const date = new Date(p.created_at).toLocaleDateString("pt-BR");
    return [
      escape(p.full_name ?? ""),
      escape(p.email ?? ""),
      escape(courses),
      escape(date),
      escape(status),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const bom = "﻿"; // BOM para Excel reconhecer UTF-8

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alunas-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
