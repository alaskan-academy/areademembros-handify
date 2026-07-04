import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

  // Buscar fórum pelo slug
  const { data: forum } = await supabase
    .from("forums")
    .select("id, title, slug, description, archived")
    .eq("slug", forumSlug)
    .single();

  if (!forum || forum.archived) notFound();

  // Verificação explícita de acesso: usuário deve estar matriculado em ao menos
  // um curso vinculado a este fórum (independente do RLS).
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") {
    const { data: access } = await supabase
      .from("enrollments")
      .select("course_id, courses!inner(forum_id)")
      .eq("user_id", user.id)
      .or("expires_at.is.null,expires_at.gt.now()");

    type EnrollmentRow = { course_id: string; courses: { forum_id: string | null } };
    const hasAccess = (access as unknown as EnrollmentRow[] ?? []).some(
      (e) => e.courses?.forum_id === forum.id
    );
    if (!hasAccess) notFound();
  }

  const service = createServiceClient();

  // 1. Buscar posts do fórum
  const postsResult = await supabase
    .from("forum_posts")
    .select(`
      id, title, body, image_url, attachment_url, attachment_name,
      pinned, approved, created_at, user_id,
      author:profiles!user_id (full_name, avatar_url)
    `)
    .eq("forum_id", forum.id)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const postIds = (postsResult.data ?? []).map((p) => p.id);

  // 2. Buscar likes e comentários em paralelo usando os IDs dos posts
  // forum_comments(count) via RLS é instável — service client + count em JS
  const [allLikesResult, userLikesResult, commentsResult] = await Promise.all([
    supabase
      .from("post_likes")
      .select("target_id")
      .eq("target_type", "forum_post"),

    supabase
      .from("post_likes")
      .select("target_id")
      .eq("target_type", "forum_post")
      .eq("user_id", user.id),

    postIds.length > 0
      ? service.from("forum_comments").select("post_id").in("post_id", postIds)
      : Promise.resolve({ data: [] }),
  ]);

  const likeCountMap = new Map<string, number>();
  (allLikesResult.data ?? []).forEach((l) => {
    likeCountMap.set(l.target_id, (likeCountMap.get(l.target_id) ?? 0) + 1);
  });
  const likedIds = new Set((userLikesResult.data ?? []).map((l) => l.target_id));

  const commentCountMap = new Map<string, number>();
  ((commentsResult as { data: { post_id: string }[] | null }).data ?? []).forEach((c) => {
    commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) ?? 0) + 1);
  });

  type PostRaw = {
    id: string; title: string; body: string; image_url: string | null;
    attachment_url: string | null; attachment_name: string | null;
    pinned: boolean; approved: boolean; created_at: string; user_id: string;
    author: { full_name: string; avatar_url: string | null } | null;
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
    comment_count: commentCountMap.get(p.id) ?? 0,
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
