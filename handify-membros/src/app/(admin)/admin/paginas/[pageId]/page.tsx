import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import PaginaFormClient from "../PaginaFormClient";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
}

export default async function EditarPaginaPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  await assertAdmin();
  const { pageId } = await params;
  const service = createServiceClient();

  const { data: page } = await service
    .from("static_pages")
    .select("*")
    .eq("id", pageId)
    .single();

  if (!page) notFound();

  const blocks = (page.blocks as Array<{ type: string; content: string }> | null) ?? [];
  const htmlBlock = blocks.find((b) => b.type === "html");
  const initialContent = htmlBlock?.content ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/paginas"
          className="p-2 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#2D2D2D]">Editar Página</h1>
          <p className="text-sm font-mono text-foreground/40">/p/{page.slug}</p>
        </div>
      </div>

      <PaginaFormClient
        id={page.id}
        initialTitle={page.title}
        initialSlug={page.slug}
        initialContent={initialContent}
        initialPublished={page.published ?? false}
      />
    </div>
  );
}
