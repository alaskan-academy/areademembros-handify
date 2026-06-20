import { createClient } from "@/lib/supabase/server";

type Slot = "header" | "lateral" | "pos-aula";

interface Props {
  slot: Slot;
}

type BannerRow = {
  id: string;
  image_url: string;
  link_url: string;
  product_codes: string[];
  starts_at: string | null;
  ends_at: string | null;
};

export default async function BannerDisplay({ slot }: Props) {
  const supabase = await createClient();
  const now = new Date();

  const [{ data: banners }, { data: { user } }] = await Promise.all([
    supabase
      .from("banners")
      .select("id, image_url, link_url, product_codes, starts_at, ends_at")
      .eq("active", true)
      .eq("position_slot", slot)
      .order("created_at"),
    supabase.auth.getUser(),
  ]);

  if (!banners?.length) return null;

  // Filtra por vigência
  const inPeriod = (banners as BannerRow[]).filter((b) => {
    if (b.starts_at && new Date(b.starts_at) > now) return false;
    if (b.ends_at && new Date(b.ends_at) < now) return false;
    return true;
  });

  if (!inPeriod.length) return null;

  // Determina product_codes que o usuário já possui (via matrícula)
  const userProductCodes = new Set<string>();

  if (user) {
    type EnrollRow = { courses: { product_code: string | null } | null };
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("courses(product_code)")
      .eq("user_id", user.id);

    for (const e of (enrollments ?? []) as unknown as EnrollRow[]) {
      const pc = e.courses?.product_code;
      if (pc) userProductCodes.add(pc);
    }
  }

  // Exibe o primeiro banner cujo produto o usuário ainda não tem
  const banner = inPeriod.find((b) => {
    if (b.product_codes.length === 0) return true; // sem restrição → mostra a todos
    return !b.product_codes.some((pc) => userProductCodes.has(pc));
  });

  if (!banner) return null;

  const isLateral = slot === "lateral";

  return (
    <a
      href={banner.link_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
      aria-label="Ver oferta"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={banner.image_url}
        alt=""
        className={[
          "w-full rounded-xl object-cover transition-opacity group-hover:opacity-90",
          isLateral ? "max-h-64" : "max-h-40",
        ].join(" ")}
        loading="lazy"
      />
    </a>
  );
}
