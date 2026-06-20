"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

const BASE = "https://api-v2.pandavideo.com.br";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const key = process.env.PANDA_VIDEO_API_KEY;
  if (!key) return NextResponse.json({ error: "PANDA_VIDEO_API_KEY not set" }, { status: 400 });

  const headers = { Authorization: key };

  async function tryFetch(path: string) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
      const text = await res.text();
      let body: unknown;
      try { body = JSON.parse(text); } catch { body = text; }
      return { status: res.status, ok: res.ok, body };
    } catch (e) {
      return { error: String(e) };
    }
  }

  const [analytics, ranking, videos] = await Promise.all([
    tryFetch("/analytics"),
    tryFetch("/analytics/ranking?page_size=5"),
    tryFetch("/videos?page=1&page_size=5"),
  ]);

  return NextResponse.json({ analytics, ranking, videos });
}
