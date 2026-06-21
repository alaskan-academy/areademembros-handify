import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ForumPage from "./ForumPage";

export async function generateMetadata({ params }: { params: Promise<{ forumSlug: string }> }) {
  const { forumSlug } = await params;
  const supabase = await createClient();
  const { data: forum } = await supabase.from("forums").select("title").eq("slug", forumSlug).single();
  return { title: forum ? `${forum.title} — Handify` : "Fórum — Handify" };
}

export default async function ForumSlugPage({ params }: { params: Promise<{ forumSlug: string }> }) {
  const { forumSlug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Buscar fórum (RLS garante acesso apenas a fóruns da matrícula)
  const { data: forum } = await supabase
    .from("forums")
    .select("id, title, slug, description")
    .eq("slug", forumSlug)
    .single();

  if (!forum) notFound();

  // Buscar posts do fórum com contagens
  const [postsResult, allLikesResult, userLikesResult] = await Promise.all([
    supabase
      .from("forum_posts")
      .select(`
        id, title, body, image_url, attachment_url, attachment_name,
        pinned, approved, created_at, user_id,
        author:profiles!user_id (full_name, avatar_url),
        forum_comments(count)
      `)
      .eq("forum_id", forum.id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("post_likes")
      .select("target_id")
      .eq("target_type", "forum_post"),

    supabase
      .from("post_likes")
      .select("target_id")
      .eq("target_type", "forum_post")
      .eq("user_id", user.id),
  ]);

  const likeCountMap = new Map<string, number>();
  (allLikesResult.data ?? []).forEach((l) => {
    likeCountMap.set(l.target_id, (likeCountMap.get(l.target_id) ?? 0) + 1);
  });
  const likedIds = new Set((userLikesResult.data ?? []).map((l) => l.target_id));

  type PostRaw = {
    id: string; title: string; body: string; image_url: string | null;
    attachment_url: string | null; attachment_name: string | null;
    pinned: boolean; approved: boolean; created_at: string; user_id: string;
    author: { full_name: string; avatar_url: string | null } | null;
    forum_comments: [{ count: number }];
  };

  const posts = (postsResult.data as unknown as PostRaw[] ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    image_url: p.image_url ?? null,
    attachment_url: p.attachment_url ?? null,
    attachment_name: p.attachment_name ?? null,
    pinned: p.pinned,
    approved: p.approved ?? true,
    created_at: p.created_at,
    user_id: p.user_id,
    author: p.author,
    like_count: likeCountMap.get(p.id) ?? 0,
    comment_count: (p.forum_comments as unknown as [{ count: number }])[0]?.count ?? 0,
  }));

  return (
    <ForumPage
      forum={{ id: forum.id, slug: forum.slug, title: forum.title, description: forum.description }}
      posts={posts}
      userId={user.id}
      likedIds={[...likedIds]}
    />
  );
}
