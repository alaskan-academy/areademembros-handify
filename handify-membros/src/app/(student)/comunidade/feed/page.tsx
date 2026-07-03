import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import FeedPostCard, { type FeedPostData } from "@/components/community/FeedPostCard";
import { Newspaper } from "lucide-react";

export const metadata = { title: "Avisos — Handify" };

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [postsResult, allLikesResult, userLikesResult] = await Promise.all([
    supabase
      .from("news_posts")
      .select(`
        id, title, body, image_url, pinned, created_at,
        author:profiles!author_id (full_name, avatar_url)
      `)
      .eq("published", true)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("post_likes")
      .select("target_id")
      .eq("target_type", "news_post"),

    supabase
      .from("post_likes")
      .select("target_id")
      .eq("target_type", "news_post")
      .eq("user_id", user.id),
  ]);

  const likeCountMap = new Map<string, number>();
  (allLikesResult.data ?? []).forEach((l) => {
    likeCountMap.set(l.target_id, (likeCountMap.get(l.target_id) ?? 0) + 1);
  });
  const likedIds = new Set((userLikesResult.data ?? []).map((l) => l.target_id));

  const posts: FeedPostData[] = (postsResult.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    image_url: p.image_url ?? null,
    pinned: p.pinned,
    created_at: p.created_at,
    author: (p.author as unknown as { full_name: string; avatar_url: string | null } | null),
    like_count: likeCountMap.get(p.id) ?? 0,
  }));

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Hero */}
      <div className="bg-white border-b border-border/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-center">
          <p className="text-sm font-medium text-[#6699F3] uppercase tracking-wide mb-3">
            Novidades
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-[#0F0F0F]">
            Avisos da <span className="text-[#6699F3]">Handify</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Novidades, lançamentos e destaques direto da equipe Handify.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma publicação ainda</p>
            <p className="text-sm mt-1">Em breve teremos novidades por aqui!</p>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                userId={user.id}
                initialLiked={likedIds.has(post.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
