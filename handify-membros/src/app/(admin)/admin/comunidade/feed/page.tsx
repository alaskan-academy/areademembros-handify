import { createClient } from "@/lib/supabase/server";
import FeedAdminClient, { type AdminNewsPost } from "./FeedAdminClient";
import { Newspaper } from "lucide-react";

export const metadata = { title: "Avisos — Admin Handify" };

export default async function AdminFeedPage() {
  const supabase = await createClient();

  const { data: postsRaw } = await supabase
    .from("news_posts")
    .select(`
      id, title, body, image_url, pinned, published, created_at,
      author:profiles!author_id (full_name),
      news_comments(count)
    `)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const posts: AdminNewsPost[] = (postsRaw ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    image_url: p.image_url ?? null,
    pinned: p.pinned,
    published: p.published,
    created_at: p.created_at,
    author: (p.author as unknown as { full_name: string } | null),
    comment_count: (p.news_comments as unknown as [{ count: number }])[0]?.count ?? 0,
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center">
          <Newspaper className="w-5 h-5 text-[#6699F3]" />
        </div>
        <div>
          <h1 className="font-black text-xl text-foreground">Avisos</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie publicações para as alunas</p>
        </div>
      </div>
      <FeedAdminClient posts={posts} />
    </div>
  );
}
