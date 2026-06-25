import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { isAllowedEmbedUrl } from "@/lib/sanitize/allowlist";

export const metadata = { title: "Conteúdo — Handify" };

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { url } = await searchParams;

  if (!url || !isAllowedEmbedUrl(url)) notFound();

  // Email sempre vem da sessão autenticada — nunca do query param
  const email = encodeURIComponent(user.email ?? "");
  const separator = url.includes("?") ? "&" : "?";
  const src = `${url}${separator}email=${email}`;

  return (
    <div className="w-full h-[calc(100svh-133px)] md:h-[calc(100svh-104px)]">
      <iframe
        src={src}
        title="Conteúdo Handify"
        className="w-full h-full border-0 block"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
