"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Camera,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  PartyPopper,
  Pencil,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  getCertificateDownloadUrl,
  updateProfile,
  uploadAvatar,
  updateEmailPrefs,
  type EmailPrefs,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  full_name: string | null;
  email: string;
  bio: string | null;
  avatar_url: string | null;
  email_prefs: EmailPrefs | null;
};

type Certificate = {
  id: string;
  issued_at: string;
  verify_hash: string;
  course: { title: string; workload_hours: number } | null;
};

type CourseCard = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
  workload_hours: number;
  completed: number;
  total: number;
  percentage: number;
  lastLessonId: string | null;
};

const DEFAULT_PREFS: EmailPrefs = {
  certificate: true,
  reengagement: true,
  news_post: true,
};

// ─── Page root ────────────────────────────────────────────────────────────────

export default function PerfilView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const newCert = searchParams.get("certificado") === "1";

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, certRes, enrollRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, bio, avatar_url, email_prefs")
          .eq("id", user.id)
          .single(),
        supabase
          .from("certificates")
          .select("id, issued_at, verify_hash, course:courses(title, workload_hours)")
          .eq("user_id", user.id)
          .order("issued_at", { ascending: false }),
        supabase
          .from("enrollments")
          .select("course:courses(id, slug, title, thumbnail_url, workload_hours)")
          .eq("user_id", user.id)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order("granted_at", { ascending: false }),
      ]);

      setProfile(profileRes.data as Profile | null);
      setCertificates((certRes.data ?? []) as unknown as Certificate[]);

      // Calcula progresso por curso
      type RawCourse = {
        id: string;
        slug: string;
        title: string;
        thumbnail_url: string | null;
        workload_hours: number;
      };
      const rawCourses = ((enrollRes.data ?? []) as unknown as { course: RawCourse | null }[])
        .map((e) => e.course)
        .filter(Boolean) as RawCourse[];

      if (rawCourses.length) {
        const courseIds = rawCourses.map((c) => c.id);

        const { data: modules } = await supabase
          .from("modules")
          .select("course_id, lessons(id, archived)")
          .eq("archived", false)
          .in("course_id", courseIds);

        type LessonRef = { id: string; archived: boolean };
        type ModRow = { course_id: string; lessons: LessonRef[] };
        const mods = (modules as ModRow[] | null) ?? [];

        const allLessonIds = mods.flatMap((m) =>
          (m.lessons ?? []).filter((l) => !l.archived).map((l) => l.id)
        );

        const lessonToCourse: Record<string, string> = {};
        for (const m of mods) {
          for (const l of m.lessons ?? []) lessonToCourse[l.id] = m.course_id;
        }

        const totalsMap: Record<string, number> = {};
        for (const m of mods) {
          totalsMap[m.course_id] = (totalsMap[m.course_id] ?? 0) + (m.lessons ?? []).filter((l) => !l.archived).length;
        }

        let completedMap: Record<string, number> = {};
        let lastLessonMap: Record<string, string> = {};

        if (allLessonIds.length) {
          const { data: progress } = await supabase
            .from("lesson_progress")
            .select("lesson_id, completed, updated_at")
            .eq("user_id", user.id)
            .in("lesson_id", allLessonIds)
            .order("updated_at", { ascending: false });

          for (const p of progress ?? []) {
            const cid = lessonToCourse[p.lesson_id];
            if (!cid) continue;
            if (p.completed) completedMap[cid] = (completedMap[cid] ?? 0) + 1;
            if (!lastLessonMap[cid]) lastLessonMap[cid] = p.lesson_id;
          }
        }

        setCourses(
          rawCourses.map((c) => {
            const total = totalsMap[c.id] ?? 0;
            const completed = completedMap[c.id] ?? 0;
            return {
              ...c,
              completed,
              total,
              percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
              lastLessonId: lastLessonMap[c.id] ?? null,
            };
          })
        );
      }

      setLoading(false);
    })();
  }, []);

  const refreshProfile = (updated: Partial<Profile>) =>
    setProfile((p) => (p ? { ...p, ...updated } : p));

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#6699F3]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      {/* Banner certificado */}
      {newCert && (
        <div className="handify-card p-4 border-[#72CF92]/40 bg-[#72CF92]/10 flex items-center gap-3">
          <PartyPopper className="w-5 h-5 text-[#72CF92] shrink-0" />
          <p className="text-sm font-medium text-[#72CF92]">
            Parabéns! Seu certificado foi gerado e está disponível abaixo. 🎉
          </p>
        </div>
      )}

      {/* Perfil */}
      <ProfileSection profile={profile} onUpdate={refreshProfile} />

      {/* Meus cursos */}
      <CoursesSection courses={courses} />

      {/* Meus certificados */}
      <CertificatesSection certificates={certificates} />

      {/* Preferências de e-mail */}
      <EmailPrefsSection
        prefs={(profile?.email_prefs as EmailPrefs | null) ?? DEFAULT_PREFS}
      />
    </div>
  );
}

// ─── Seção: Perfil ────────────────────────────────────────────────────────────

function ProfileSection({
  profile,
  onUpdate,
}: {
  profile: Profile | null;
  onUpdate: (p: Partial<Profile>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [avatarPending, setAvatarPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initial = (profile?.full_name ?? profile?.email ?? "A")
    .charAt(0)
    .toUpperCase();

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateProfile({ fullName, bio });
      if (result.error) {
        setError(result.error);
      } else {
        onUpdate({ full_name: fullName, bio: bio || null });
        setEditing(false);
      }
    });
  };

  const handleCancel = () => {
    setFullName(profile?.full_name ?? "");
    setBio(profile?.bio ?? "");
    setError(null);
    setEditing(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPending(true);
    const fd = new FormData();
    fd.append("avatar", file);
    const result = await uploadAvatar(fd);
    setAvatarPending(false);
    if (result.url) {
      setAvatarUrl(result.url);
      onUpdate({ avatar_url: result.url });
    }
    e.target.value = "";
  };

  return (
    <section className="handify-card p-6 space-y-5">
      <div className="flex items-start gap-4">
        {/* Avatar com upload */}
        <div className="relative shrink-0">
          <button
            onClick={() => fileRef.current?.click()}
            className="group relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#6699F3]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6699F3]"
            aria-label="Alterar foto de perfil"
            disabled={avatarPending}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={profile?.full_name ?? "Avatar"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white font-bold text-2xl"
                style={{ background: "#6699F3" }}
              >
                {initial}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarPending ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full text-xl font-bold bg-transparent border-b border-[#6699F3]/50 focus:border-[#6699F3] outline-none pb-0.5 placeholder:text-muted-foreground/50"
              autoFocus
            />
          ) : (
            <h1 className="text-xl font-bold truncate">
              {profile?.full_name ?? "—"}
            </h1>
          )}
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {profile?.email}
          </p>
        </div>

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-[#6699F3] hover:bg-[#6699F3]/10 transition-colors"
            aria-label="Editar perfil"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Bio */}
      {editing ? (
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Uma breve descrição sobre você…"
          rows={3}
          maxLength={300}
          className="w-full text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#6699F3]/50 placeholder:text-muted-foreground/50"
        />
      ) : profile?.bio ? (
        <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
      ) : null}

      {/* Ações de edição */}
      {editing && (
        <div className="space-y-2">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1.5 text-sm font-medium bg-[#6699F3] text-white px-4 py-1.5 rounded-lg hover:bg-[#5580d4] disabled:opacity-60 transition-colors"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Salvar
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Seção: Meus Cursos ───────────────────────────────────────────────────────

function CoursesSection({ courses }: { courses: CourseCard[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-[#6699F3]" />
        Meus cursos
      </h2>

      {!courses.length ? (
        <div className="handify-card p-8 text-center space-y-2">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-semibold">Nenhum curso ainda</p>
          <p className="text-sm text-muted-foreground">
            Explore o catálogo e comece sua jornada.
          </p>
          <Link
            href="/cursos"
            className="inline-block mt-2 text-sm font-medium text-[#6699F3] hover:underline"
          >
            Ver cursos disponíveis →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const isComplete = course.percentage === 100;
            const hasStarted = !!course.lastLessonId;
            const href = hasStarted
              ? `/aulas/${course.lastLessonId}`
              : `/cursos/${course.slug}`;

            return (
              <div key={course.id} className="handify-card p-4 flex items-center gap-4">
                {/* Thumbnail */}
                <Link href={href} className="shrink-0">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#6699F3]/10">
                    {course.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">
                        🎨
                      </div>
                    )}
                  </div>
                </Link>

                {/* Info + progresso */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Link href={`/cursos/${course.slug}`}>
                    <p className="font-semibold text-sm line-clamp-1 hover:text-[#6699F3] transition-colors">
                      {course.title}
                    </p>
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {course.workload_hours}h de conteúdo
                  </p>
                  {course.total > 0 && (
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>
                          {course.completed}/{course.total} aulas
                        </span>
                        <span
                          className={cn(
                            "font-semibold",
                            isComplete ? "text-[#72CF92]" : "text-[#6699F3]"
                          )}
                        >
                          {course.percentage}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${course.percentage}%`,
                            background: isComplete ? "#72CF92" : "#6699F3",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Botão */}
                <Link
                  href={href}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors",
                    isComplete
                      ? "bg-[#72CF92]/15 text-[#72CF92] hover:bg-[#72CF92]/25"
                      : "bg-[#6699F3] text-white hover:bg-[#5580d4]"
                  )}
                >
                  {isComplete ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Rever
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
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Seção: Certificados ──────────────────────────────────────────────────────

function CertificatesSection({ certificates }: { certificates: Certificate[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Award className="w-5 h-5 text-[#6699F3]" />
        Meus certificados
      </h2>

      {!certificates.length ? (
        <div className="handify-card p-8 text-center space-y-2">
          <Award className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-semibold">Nenhum certificado ainda</p>
          <p className="text-sm text-muted-foreground">
            Conclua as aulas de um curso para receber seu certificado.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {certificates.map((cert) => (
            <CertificateCard key={cert.id} cert={cert} />
          ))}
        </div>
      )}
    </section>
  );
}

function CertificateCard({ cert }: { cert: Certificate }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const handleDownload = () => {
    startTransition(async () => {
      setError(false);
      const url = await getCertificateDownloadUrl(cert.id);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setError(true);
      }
    });
  };

  const formattedDate = new Date(cert.issued_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verificar/${cert.verify_hash}`
      : `/verificar/${cert.verify_hash}`;

  return (
    <div className="handify-card p-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-[#6699F3]/15 flex items-center justify-center shrink-0">
        <Award className="w-5 h-5 text-[#6699F3]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm line-clamp-1">
          {cert.course?.title ?? "Curso"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {cert.course?.workload_hours ?? 0}h · Emitido em {formattedDate}
        </p>
        {error && (
          <p className="text-xs text-red-500 mt-1">Erro ao gerar link. Tente novamente.</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-muted-foreground hover:text-[#6699F3] transition-colors rounded"
          aria-label="Verificar autenticidade"
          title="Verificar autenticidade"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button
          onClick={handleDownload}
          disabled={isPending}
          className="flex items-center gap-1.5 text-xs font-medium text-[#6699F3] hover:bg-[#6699F3]/10 px-2.5 py-1.5 rounded-lg transition-colors"
          aria-label="Baixar certificado em PDF"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          Baixar PDF
        </button>
      </div>
    </div>
  );
}

// ─── Seção: Preferências de e-mail ────────────────────────────────────────────

const PREF_LABELS: { key: keyof EmailPrefs; label: string; description: string }[] = [
  {
    key: "certificate",
    label: "Certificado disponível",
    description: "E-mail com PDF ao concluir um curso",
  },
  {
    key: "reengagement",
    label: "Lembrete de progresso",
    description: "Aviso quando ficar 7 dias sem acessar um curso em andamento",
  },
  {
    key: "news_post",
    label: "Novidades da Handify",
    description: "Novos cursos, avisos e destaques da comunidade",
  },
];

function EmailPrefsSection({ prefs }: { prefs: EmailPrefs }) {
  const [current, setCurrent] = useState<EmailPrefs>(prefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = async (key: keyof EmailPrefs) => {
    const next = { ...current, [key]: !current[key] };
    setCurrent(next);
    setSaving(true);
    setSaved(false);
    await updateEmailPrefs(next);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#6699F3]" />
          Preferências de e-mail
        </h2>
        <span
          className={cn(
            "text-xs transition-opacity duration-300",
            saved ? "text-[#72CF92] opacity-100" : "opacity-0"
          )}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground inline" />
          ) : (
            "Salvo ✓"
          )}
        </span>
      </div>

      <div className="handify-card divide-y divide-border/60">
        {PREF_LABELS.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between p-4 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <button
              role="switch"
              aria-checked={current[key]}
              onClick={() => toggle(key)}
              className={cn(
                "relative shrink-0 w-10 h-5.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6699F3] focus-visible:ring-offset-2",
                current[key] ? "bg-[#6699F3]" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                  current[key] ? "translate-x-4.5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        E-mails de boas-vindas e confirmação de acesso são sempre enviados e não podem ser desativados.
      </p>
    </section>
  );
}
