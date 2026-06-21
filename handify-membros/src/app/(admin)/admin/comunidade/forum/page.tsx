import { createClient } from "@/lib/supabase/server";
import { MessageSquare } from "lucide-react";
import ForumModerationClient from "./ForumModerationClient";

export const metadata = { title: "Fórum — Moderação Admin Handify" };

export default async function AdminForumPage() {
  const supabase = await createClient();

  const { data: postsRaw } = await supabase
    .from("forum_posts")
    .select(`
      id, title, body, pinned, approved, created_at, forum_id,
      attachment_url, attachment_name,
      author:profiles!user_id (full_name),
      forums!forum_id (title, slug),
      forum_comments(count)
    `)
    .order("approved", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  type PostRaw = {
    id: string; title: string; body: string; pinned: boolean; approved: boolean;
    created_at: string; forum_id: string | null;
    attachment_url: string | null; attachment_name: string | null;
    author: { full_name: string } | null;
    forums: { title: string; slug: string } | null;
    forum_comments: [{ count: number }];
  };

  const posts = ((postsRaw as unknown as PostRaw[]) ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    pinned: p.pinned,
    approved: p.approved ?? true,
    created_at: p.created_at,
    forum_id: p.forum_id,
    attachment_url: p.attachment_url,
    attachment_name: p.attachment_name,
    author_name: p.author?.full_name ?? "—",
    forum_title: p.forums?.title ?? "—",
    forum_slug: p.forums?.slug ?? "",
    comment_count: (p.forum_comments as unknown as [{ count: number }])[0]?.count ?? 0,
  }));

  const pendingCount = posts.filter((p) => !p.approved).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-[#6699F3]" />
        </div>
        <div>
          <h1 className="font-black text-xl text-foreground">Moderação do Fórum</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount > 0 ? (
              <span className="text-[#FEC649] font-semibold">{pendingCount} aguardando aprovação</span>
            ) : (
              "Nenhum post pendente"
            )}
            {" · "}{posts.length} posts no total
          </p>
        </div>
      </div>
      <ForumModerationClient posts={posts} />
    </div>
  );
}
