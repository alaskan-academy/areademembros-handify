import { fetchAll } from "@/lib/supabase/fetch-all";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EngajamentoPage from "@/components/admin/metrics/EngajamentoPage";

// Envolve fetchAll devolvendo { data } para o restante do arquivo nao mudar.
async function pag<T>(q: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  return { data: await fetchAll<T>(q) };
}

export default async function EngajamentoAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { periodo } = await searchParams;
  const days = periodo === "7d" ? 7 : periodo === "30d" ? 30 : null;
  const since = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const service = createServiceClient();

  type Row = { id: string; user_id: string };

  // Step 1: query all activity tables in parallel
  // Cada uma paginada: lesson_progress sozinha tem 22 mil linhas e o Supabase
  // corta em 1.000, o que subestimava o engajamento sem avisar.
  const fpq = (de: number, ate: number) => service.from("forum_posts").select("id, user_id").range(de, ate);
  const fcq = (de: number, ate: number) => service.from("forum_comments").select("id, user_id").range(de, ate);
  const ssq = (de: number, ate: number) => service.from("supplier_suggestions").select("id, user_id").range(de, ate);
  const lpq = (de: number, ate: number) => service.from("lesson_progress").select("user_id").eq("completed", true).range(de, ate);
  const ilq = (de: number, ate: number) => service.from("inspiration_likes").select("user_id").range(de, ate);
  const ibq = (de: number, ate: number) => service.from("inspiration_bookmarks").select("user_id").range(de, ate);
  const icq = (de: number, ate: number) => service.from("inspiration_comments").select("user_id").eq("approved", true).range(de, ate);

  const [
    { data: forumPostsRaw },
    { data: forumCommentsRaw },
    { data: suggestionsRaw },
    { data: lessonsRaw },
    { data: inspLikesRaw },
    { data: inspBookmarksRaw },
    { data: inspCommentsRaw },
  ] = await Promise.all([
    pag((de, ate) => (since ? fpq(de, ate).gte("created_at", since) : fpq(de, ate))),
    pag((de, ate) => (since ? fcq(de, ate).gte("created_at", since) : fcq(de, ate))),
    pag((de, ate) => (since ? ssq(de, ate).gte("created_at", since) : ssq(de, ate))),
    pag((de, ate) => (since ? lpq(de, ate).gte("updated_at", since) : lpq(de, ate))),
    pag((de, ate) => (since ? ilq(de, ate).gte("created_at", since) : ilq(de, ate))),
    pag((de, ate) => (since ? ibq(de, ate).gte("created_at", since) : ibq(de, ate))),
    pag((de, ate) => (since ? icq(de, ate).gte("created_at", since) : icq(de, ate))),
  ]);

  const forumPosts = (forumPostsRaw ?? []) as Row[];
  const forumComments = (forumCommentsRaw ?? []) as Row[];
  const suggestions = (suggestionsRaw ?? []) as Row[];
  const lessons = (lessonsRaw ?? []) as { user_id: string }[];
  const inspLikes = (inspLikesRaw ?? []) as { user_id: string }[];
  const inspBookmarks = (inspBookmarksRaw ?? []) as { user_id: string }[];
  const inspComments = (inspCommentsRaw ?? []) as { user_id: string }[];

  // Step 2: aggregate counts by user_id
  type Counts = {
    forumPosts: number;
    forumComments: number;
    suggestions: number;
    lessonsCompleted: number;
    inspLikes: number;
    inspBookmarks: number;
    inspComments: number;
  };
  const scores: Record<string, Counts> = {};

  function ensure(userId: string) {
    if (!scores[userId])
      scores[userId] = {
        forumPosts: 0,
        forumComments: 0,
        suggestions: 0,
        lessonsCompleted: 0,
        inspLikes: 0,
        inspBookmarks: 0,
        inspComments: 0,
      };
  }

  for (const r of forumPosts) { ensure(r.user_id); scores[r.user_id].forumPosts++; }
  for (const r of forumComments) { ensure(r.user_id); scores[r.user_id].forumComments++; }
  for (const r of suggestions) { ensure(r.user_id); scores[r.user_id].suggestions++; }
  for (const r of lessons) { ensure(r.user_id); scores[r.user_id].lessonsCompleted++; }
  for (const r of inspLikes) { ensure(r.user_id); scores[r.user_id].inspLikes++; }
  for (const r of inspBookmarks) { ensure(r.user_id); scores[r.user_id].inspBookmarks++; }
  for (const r of inspComments) { ensure(r.user_id); scores[r.user_id].inspComments++; }

  // Step 3: collect unique user IDs and fetch their profiles
  const userIds = Object.keys(scores);
  const { data: profilesRaw } = userIds.length > 0
    ? await service.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds)
    : { data: [] };

  type ProfileRow = {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  const profiles = (profilesRaw ?? []) as ProfileRow[];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const ranking = Object.entries(scores)
    .map(([userId, c]) => {
      const profile = profileMap.get(userId);
      return {
        userId,
        profile: profile ?? { full_name: null, email: "", avatar_url: null },
        forumPosts: c.forumPosts,
        forumComments: c.forumComments,
        suggestions: c.suggestions,
        lessonsCompleted: c.lessonsCompleted,
        inspLikes: c.inspLikes,
        inspBookmarks: c.inspBookmarks,
        inspComments: c.inspComments,
        score:
          c.forumPosts * 3 +
          c.forumComments * 2 +
          c.suggestions * 3 +
          c.lessonsCompleted +
          c.inspLikes * 1 +
          c.inspBookmarks * 2 +
          c.inspComments * 3,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const totals = {
    posts: forumPosts.length,
    comments: forumComments.length,
    suggestions: suggestions.length,
    lessonsCompleted: lessons.length,
    activeStudents: Object.keys(scores).length,
    inspLikes: inspLikes.length,
    inspBookmarks: inspBookmarks.length,
    inspComments: inspComments.length,
  };

  return (
    <EngajamentoPage ranking={ranking} totals={totals} periodo={periodo ?? "all"} />
  );
}
