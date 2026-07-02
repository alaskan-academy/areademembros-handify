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
  type ProfileRow = {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };

  // Build each query conditionally with optional .gte() filter
  const fpq = service.from("forum_posts").select("id, user_id");
  const fcq = service.from("forum_comments").select("id, user_id");
  const ncq = service.from("news_comments").select("id, user_id");
  const ssq = service.from("supplier_suggestions").select("id, user_id");

  const [
    { data: forumPostsRaw },
    { data: forumCommentsRaw },
    { data: newsCommentsRaw },
    { data: suggestionsRaw },
    { data: profilesRaw },
  ] = await Promise.all([
    since ? fpq.gte("created_at", since) : fpq,
    since ? fcq.gte("created_at", since) : fcq,
    since ? ncq.gte("created_at", since) : ncq,
    since ? ssq.gte("created_at", since) : ssq,
    service.from("profiles").select("id, full_name, email, avatar_url").eq("role", "student"),
  ]);

  const forumPosts = (forumPostsRaw ?? []) as Row[];
  const forumComments = (forumCommentsRaw ?? []) as Row[];
  const newsComments = (newsCommentsRaw ?? []) as Row[];
  const suggestions = (suggestionsRaw ?? []) as Row[];
  const profiles = (profilesRaw ?? []) as ProfileRow[];

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  type Counts = {
    forumPosts: number;
    forumComments: number;
    newsComments: number;
    suggestions: number;
  };
  const scores: Record<string, Counts> = {};

  function ensure(userId: string) {
    if (!scores[userId])
      scores[userId] = { forumPosts: 0, forumComments: 0, newsComments: 0, suggestions: 0 };
  }

  for (const r of forumPosts) { ensure(r.user_id); scores[r.user_id].forumPosts++; }
  for (const r of forumComments) { ensure(r.user_id); scores[r.user_id].forumComments++; }
  for (const r of newsComments) { ensure(r.user_id); scores[r.user_id].newsComments++; }
  for (const r of suggestions) { ensure(r.user_id); scores[r.user_id].suggestions++; }

  const ranking = Object.entries(scores)
    .map(([userId, c]) => ({
      userId,
      profile: profileMap.get(userId) ?? {
        full_name: null,
        email: userId,
        avatar_url: null,
      },
      forumPosts: c.forumPosts,
      forumComments: c.forumComments,
      newsComments: c.newsComments,
      suggestions: c.suggestions,
      score: c.forumPosts * 3 + c.forumComments * 2 + c.newsComments * 2 + c.suggestions * 3,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const totals = {
    posts: forumPosts.length,
    comments: forumComments.length + newsComments.length,
    suggestions: suggestions.length,
    activeStudents: Object.keys(scores).length,
  };

  return (
    <EngajamentoPage ranking={ranking} totals={totals} periodo={periodo ?? "all"} />
  );
}
