import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Play, RotateCcw, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type EnrolledCourse = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
  workload_hours: number;
};

type CourseCard = {
  course: EnrolledCourse;
  progress: { completed: number; total: number; percentage: number };
  lastLessonId: string | null;
  firstLessonId: string | null;
  lastAccess: string | null;
};

export default async function MinhaJornadaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date().toISOString();

  const [{ data: profile }, { data: enrollments }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("enrollments")
      .select("course:courses(id, slug, title, thumbnail_url, workload_hours), granted_at")
      .eq("user_id", user.id)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("granted_at", { ascending: false }),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] || "aluna";

  const courses = (enrollments ?? [])
    .map((e) => e.course as unknown as EnrolledCourse | null)
    .filter(Boolean) as EnrolledCourse[];

  const cards: CourseCard[] = [];

  if (courses.length > 0) {
    const courseIds = courses.map((c) => c.id);

    const { data: modules } = await supabase
      .from("modules")
      .select("course_id, id, position, lessons(id, position, archived)")
      .eq("archived", false)
      .in("course_id", courseIds);

    type LessonRef = { id: string; position: number; archived: boolean };
    type ModuleRow = { course_id: string; id: string; position: number; lessons: LessonRef[] };
    const modRows = (modules as ModuleRow[] | null) ?? [];

    // first lesson por curso (menor position de módulo e aula)
    const firstLessonMap: Record<string, string> = {};
    const courseModules: Record<string, ModuleRow[]> = {};
    for (const m of modRows) {
      if (!courseModules[m.course_id]) courseModules[m.course_id] = [];
      courseModules[m.course_id].push(m);
    }
    for (const [cid, mods] of Object.entries(courseModules)) {
      const sorted = mods.sort((a, b) => a.position - b.position);
      for (const mod of sorted) {
        const lessons = (mod.lessons ?? [])
          .filter((l) => !l.archived)
          .sort((a, b) => a.position - b.position);
        if (lessons.length > 0) {
          firstLessonMap[cid] = lessons[0].id;
          break;
        }
      }
    }

    const allLessonIds = modRows.flatMap((m) =>
      (m.lessons ?? []).filter((l) => !l.archived).map((l) => l.id)
    );

    const progressMap: Record<string, { completed: number; total: number; percentage: number }> =
      {};
    const lastLessonMap: Record<string, string> = {};
    const lastAccessMap: Record<string, string> = {};

    if (allLessonIds.length > 0) {
      const { data: allProgress } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed, updated_at")
        .eq("user_id", user.id)
        .in("lesson_id", allLessonIds)
        .order("updated_at", { ascending: false });

      const progressRows = allProgress ?? [];

      const lessonToCourse: Record<string, string> = {};
      for (const mod of modRows) {
        for (const l of mod.lessons ?? []) {
          if (!l.archived) lessonToCourse[l.id] = mod.course_id;
        }
      }

      const lessonCount: Record<string, number> = {};
      for (const mod of modRows) {
        const cid = mod.course_id;
        lessonCount[cid] = (lessonCount[cid] ?? 0) + (mod.lessons ?? []).filter((l) => !l.archived).length;
      }

      const completedSet = new Set<string>();
      for (const p of progressRows) {
        if (p.completed) completedSet.add(p.lesson_id);
      }

      for (const p of progressRows) {
        const cid = lessonToCourse[p.lesson_id];
        if (cid) {
          if (!lastLessonMap[cid]) lastLessonMap[cid] = p.lesson_id;
          if (!lastAccessMap[cid]) lastAccessMap[cid] = p.updated_at;
        }
      }

      for (const cid of courseIds) {
        const total = lessonCount[cid] ?? 0;
        const completed = courses
          .find((c) => c.id === cid)
          ? modRows
              .filter((m) => m.course_id === cid)
              .flatMap((m) => (m.lessons ?? []).filter((l) => !l.archived))
              .filter((l) => completedSet.has(l.id)).length
          : 0;
        progressMap[cid] = {
          completed,
          total,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      }
    } else {
      for (const cid of courseIds) {
        progressMap[cid] = { completed: 0, total: 0, percentage: 0 };
      }
    }

    for (const course of courses) {
      cards.push({
        course,
        progress: progressMap[course.id] ?? { completed: 0, total: 0, percentage: 0 },
        lastLessonId: lastLessonMap[course.id] ?? null,
        firstLessonId: firstLessonMap[course.id] ?? null,
        lastAccess: lastAccessMap[course.id] ?? null,
      });
    }
  }

  // Agrupa em 3 seções
  const continuar = cards
    .filter((c) => c.lastLessonId && c.progress.percentage < 100)
    .sort((a, b) => (b.lastAccess ?? "").localeCompare(a.lastAccess ?? ""));

  const comecar = cards.filter((c) => !c.lastLessonId && c.progress.percentage < 100);

  const refazer = cards.filter((c) => c.progress.percentage === 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-bold">
          Minha <span className="accent-word">Jornada</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Olá, {firstName}! Continue de onde parou ou comece algo novo.
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="handify-card p-12 text-center space-y-4">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <p className="font-semibold text-lg">Você ainda não tem cursos</p>
            <p className="text-sm text-muted-foreground mt-1">
              Explore o catálogo e comece sua jornada artesanal.
            </p>
          </div>
          <Link
            href="/cursos"
            className="inline-flex items-center min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors bg-[#6699F3] hover:bg-[#5580d4]"
          >
            Explorar cursos
          </Link>
        </div>
      ) : (
        <>
          {continuar.length > 0 && (
            <JornadaSection title="Continuar assistindo" badge={continuar.length}>
              {continuar.map((c) => (
                <CourseProgressCard key={c.course.id} card={c} />
              ))}
            </JornadaSection>
          )}

          {comecar.length > 0 && (
            <JornadaSection title="Começar" badge={comecar.length}>
              {comecar.map((c) => (
                <CourseProgressCard key={c.course.id} card={c} />
              ))}
            </JornadaSection>
          )}

          {refazer.length > 0 && (
            <JornadaSection title="Refazer" badge={refazer.length}>
              {refazer.map((c) => (
                <CourseProgressCard key={c.course.id} card={c} />
              ))}
            </JornadaSection>
          )}
        </>
      )}

      {/* Link para explorar mais */}
      {cards.length > 0 && (
        <div className="text-center pt-2">
          <Link
            href="/cursos"
            className="text-sm text-[#6699F3] font-medium hover:underline"
          >
            Explorar mais cursos →
          </Link>
        </div>
      )}
    </div>
  );
}

function JornadaSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#6699F3]/10 text-[#6699F3]">
          {badge}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </section>
  );
}

function CourseProgressCard({ card }: { card: CourseCard }) {
  const { course, progress, lastLessonId, firstLessonId } = card;
  const isComplete = progress.percentage === 100;
  const hasStarted = !!lastLessonId;

  const href = lastLessonId
    ? `/aulas/${lastLessonId}`
    : firstLessonId
    ? `/aulas/${firstLessonId}`
    : `/cursos/${course.slug}`;

  return (
    <div className="group handify-card overflow-hidden flex flex-col">
      <Link href={href} className="block">
        <div className="aspect-video bg-muted relative overflow-hidden">
          {course.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#6699F3]/10 text-3xl">
              🎨
            </div>
          )}
          {isComplete && (
            <div className="absolute top-2 right-2 bg-[#72CF92] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Concluído ✓
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <Link href={`/cursos/${course.slug}`}>
          <h3 className="font-semibold text-sm line-clamp-2 hover:text-[#6699F3] transition-colors">
            {course.title}
          </h3>
        </Link>

        {progress.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px] text-muted-foreground">
              <span>
                {progress.completed}/{progress.total} aulas
              </span>
              <span
                className={cn(
                  "font-semibold",
                  isComplete ? "text-[#72CF92]" : "text-[#6699F3]"
                )}
              >
                {progress.percentage}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress.percentage}%`,
                  background: isComplete ? "#72CF92" : "#6699F3",
                }}
              />
            </div>
          </div>
        )}

        <Link
          href={href}
          className={cn(
            "mt-auto flex items-center justify-center gap-2 py-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors",
            isComplete
              ? "bg-[#72CF92]/15 text-[#72CF92] hover:bg-[#72CF92]/25"
              : hasStarted
              ? "bg-[#6699F3] text-white hover:bg-[#5580d4]"
              : "bg-muted text-foreground hover:bg-muted/80"
          )}
        >
          {isComplete ? (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              Rever curso
            </>
          ) : hasStarted ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Continuar
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Começar
            </>
          )}
        </Link>
      </div>
    </div>
  );
}
