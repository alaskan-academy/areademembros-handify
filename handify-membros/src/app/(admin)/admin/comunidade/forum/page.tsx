import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MessageSquare, Trash2, Pin, PinOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ForumModerationClient from "./ForumModerationClient";

export const metadata = { title: "Fórum — Moderação Admin Handify" };

export default async function AdminForumPage() {
  const supabase = await createClient();

  const { data: postsRaw } = await supabase
    .from("forum_posts")
    .select(`
      id, title, body, pinned, created_at, course_id,
      author:profiles!user_id (full_name),
      courses!course_id (title, slug),
      forum_comments(count)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  type PostRaw = {
    id: string; title: string; body: string; pinned: boolean; created_at: string; course_id: string;
    author: { full_name: string } | null;
    courses: { title: string; slug: string } | null;
    forum_comments: [{ count: number }];
  };

  const posts = ((postsRaw as unknown as PostRaw[]) ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    pinned: p.pinned,
    created_at: p.created_at,
    course_id: p.course_id,
    author_name: p.author?.full_name ?? "—",
    course_title: p.courses?.title ?? "—",
    course_slug: p.courses?.slug ?? "",
    comment_count: (p.forum_comments as unknown as [{ count: number }])[0]?.count ?? 0,
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-[#6699F3]" />
        </div>
        <div>
          <h1 className="font-black text-xl text-foreground">Moderação do Fórum</h1>
          <p className="text-sm text-muted-foreground">Últimos 100 posts de todos os cursos</p>
        </div>
      </div>
      <ForumModerationClient posts={posts} />
    </div>
  );
}
