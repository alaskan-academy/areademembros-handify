import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Biblioteca — Handify" };

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const src = `https://biblioteca.handify.com.br/?email=${encodeURIComponent(user.email ?? "")}`;

  return (
    <div className="w-full h-[calc(100svh-133px)] md:h-[calc(100svh-104px)]">
      <iframe
        src={src}
        title="Biblioteca Handify"
        className="w-full h-full border-0 block"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
