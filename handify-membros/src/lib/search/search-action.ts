"use server";

import { createServiceClient } from "@/lib/supabase/service";

export type SearchResult = {
  type: "course" | "lesson" | "news";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type SearchResults = {
  courses: SearchResult[];
  lessons: SearchResult[];
  news: SearchResult[];
  total: number;
};

export async function searchPlatform(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return { courses: [], lessons: [], news: [], total: 0 };

  const service = createServiceClient();
  const pattern = `%${q}%`;

  const [{ data: courses }, { data: lessonRows }, { data: newsPosts }] =
    await Promise.all([
      service
        .from("courses")
        .select("id, slug, title, description")
        .eq("published", true)
        .ilike("title", pattern)
        .limit(5),

      service
        .from("lessons")
        .select("id, title, module:modules(course_id, courses(title, slug, published))")
        .ilike("title", pattern)
        .limit(10),

      service
        .from("news_posts")
        .select("id, title, body")
        .eq("published", true)
        .ilike("title", pattern)
        .limit(4),
    ]);

  const courseResults: SearchResult[] = (courses ?? []).map((c) => ({
    type: "course",
    id: c.id,
    title: c.title,
    subtitle: c.description
      ? c.description.slice(0, 90) + (c.description.length > 90 ? "…" : "")
      : "Curso",
    href: `/cursos/${c.slug}`,
  }));

  const lessonResults: SearchResult[] = (lessonRows ?? [])
    .filter((l) => {
      const mod = l.module as unknown as {
        courses: { published: boolean; slug: string } | null;
      } | null;
      return mod?.courses?.published && mod?.courses?.slug;
    })
    .slice(0, 5)
    .map((l) => {
      const mod = l.module as unknown as {
        courses: { title: string; slug: string };
      };
      return {
        type: "lesson" as const,
        id: l.id,
        title: l.title,
        subtitle: mod.courses.title,
        href: `/aulas/${l.id}`,
      };
    });

  const newsResults: SearchResult[] = (newsPosts ?? []).map((n) => ({
    type: "news",
    id: n.id,
    title: n.title,
    subtitle: n.body
      ? n.body.slice(0, 90) + (n.body.length > 90 ? "…" : "")
      : "Post do feed",
    href: `/comunidade/feed`,
  }));

  return {
    courses: courseResults,
    lessons: lessonResults,
    news: newsResults,
    total: courseResults.length + lessonResults.length + newsResults.length,
  };
}
