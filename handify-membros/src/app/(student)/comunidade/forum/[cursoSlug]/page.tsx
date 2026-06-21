import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ForumCoursePage from "./ForumCoursePage";

export async function generateMetadata({ params }: { params: Promise<{ cursoSlug: string }> }) {
  const { cursoSlug } = await params;
  return { title: `Fórum — Handify` };
}

export default async function ForumPage({ params }: { params: Promise<{ cursoSlug: string }> }) {
  const { cursoSlug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Buscar curso
  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, thumbnail_url")
    .eq("slug", cursoSlug)
    .eq("published", true)
    .single();

  if (!course) notFound();

  // Verificar matrícula
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .or("expires_at.is.null,expires_at.gt.now()")
    .maybeSingle();

  if (!enrollment) redirect(`/cursos/${cursoSlug}`);

  // Buscar posts do fórum com contagens
  const [postsResult, allLikesResult, userLikesResult] = await Promise.all([
    supabase
      .from("forum_posts")
      .select(`
        id, title, body, image_url, attachment_url, attachment_name, pinned, approved, created_at, user_id,
        author:profiles!user_id (full_name, avatar_url),
        forum_comments(count)
      `)
      .eq("course_id", course.id)
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
    <ForumCoursePage
      course={{ id: course.id, slug: course.slug, title: course.title }}
      posts={posts}
      userId={user.id}
      likedIds={[...likedIds]}
    />
  );
}
