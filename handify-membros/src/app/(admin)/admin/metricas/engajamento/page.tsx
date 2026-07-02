import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EngajamentoPage from "@/components/admin/metrics/EngajamentoPage";

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
  const fpq = service.from("forum_posts").select("id, user_id");
  const fcq = service.from("forum_comments").select("id, user_id");
  const ncq = service.from("news_comments").select("id, user_id");
  const ssq = service.from("supplier_suggestions").select("id, user_id");
  const lpq = service.from("lesson_progress").select("user_id").eq("completed", true);

  const [
    { data: forumPostsRaw },
    { data: forumCommentsRaw },
    { data: newsCommentsRaw },
    { data: suggestionsRaw },
    { data: lessonsRaw },
  ] = await Promise.all([
    since ? fpq.gte("created_at", since) : fpq,
    since ? fcq.gte("created_at", since) : fcq,
    since ? ncq.gte("created_at", since) : ncq,
    since ? ssq.gte("created_at", since) : ssq,
    since ? lpq.gte("updated_at", since) : lpq,
  ]);

  const forumPosts = (forumPostsRaw ?? []) as Row[];
  const forumComments = (forumCommentsRaw ?? []) as Row[];
  const newsComments = (newsCommentsRaw ?? []) as Row[];
  const suggestions = (suggestionsRaw ?? []) as Row[];
  const lessons = (lessonsRaw ?? []) as { user_id: string }[];

  // Step 2: aggregate counts by user_id
  type Counts = {
    forumPosts: number;
    forumComments: number;
    newsComments: number;
    suggestions: number;
    lessonsCompleted: number;
  };
  const scores: Record<string, Counts> = {};

  function ensure(userId: string) {
    if (!scores[userId])
      scores[userId] = {
        forumPosts: 0,
        forumComments: 0,
        newsComments: 0,
        suggestions: 0,
        lessonsCompleted: 0,
      };
  }

  for (const r of forumPosts) { ensure(r.user_id); scores[r.user_id].forumPosts++; }
  for (const r of forumComments) { ensure(r.user_id); scores[r.user_id].forumComments++; }
  for (const r of newsComments) { ensure(r.user_id); scores[r.user_id].newsComments++; }
  for (const r of suggestions) { ensure(r.user_id); scores[r.user_id].suggestions++; }
  for (const r of lessons) { ensure(r.user_id); scores[r.user_id].lessonsCompleted++; }

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
        newsComments: c.newsComments,
        suggestions: c.suggestions,
        lessonsCompleted: c.lessonsCompleted,
        score:
          c.forumPosts * 3 +
          c.forumComments * 2 +
          c.newsComments * 2 +
          c.suggestions * 3 +
          c.lessonsCompleted,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const totals = {
    posts: forumPosts.length,
    comments: forumComments.length + newsComments.length,
    suggestions: suggestions.length,
    lessonsCompleted: lessons.length,
    activeStudents: Object.keys(scores).length,
  };

  return (
    <EngajamentoPage ranking={ranking} totals={totals} periodo={periodo ?? "all"} />
  );
}
