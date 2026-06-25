import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import HtmlContent from "./HtmlContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("static_pages")
    .select("title")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  return {
    title: page?.title ? `${page.title} — Handify™` : "Handify™",
  };
}

export default async function StaticPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("static_pages")
    .select("id, title, blocks, created_at")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!page) notFound();

  const blocks = (page.blocks as Array<{ type: string; content: string }> | null) ?? [];
  const htmlBlock = blocks.find((b) => b.type === "html");

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header simples */}
      <header className="bg-white border-b border-border/60 sticky top-0 z-10">
        <div className="flex h-1">
          <span className="flex-1 bg-[#6699F3]" />
          <span className="flex-1 bg-[#72CF92]" />
          <span className="flex-1 bg-[#FEC649]" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-4">
          <Link href="/cursos" className="flex items-center gap-2 shrink-0">
            <Image
              src="/logo-vertical-azul.png"
              alt="Handify™"
              width={26}
              height={26}
              unoptimized
              className="object-contain"
            />
            <span className="font-black text-sm" style={{ color: "#6699F3" }}>
              Handify<sup className="text-[10px] ml-px">™</sup>
            </span>
          </Link>
          <div className="flex-1" />
          <Link
            href="/cursos"
            className="text-xs text-foreground/50 hover:text-foreground transition-colors"
          >
            Voltar à plataforma
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-border/60 px-6 sm:px-10 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-black text-[#2D2D2D] mb-8 pb-6 border-b border-border/40">
            {page.title}
          </h1>

          {htmlBlock?.content ? (
            <HtmlContent html={htmlBlock.content} />
          ) : (
            <p className="text-muted-foreground text-sm">Conteúdo não disponível.</p>
          )}

          <p className="text-xs text-foreground/30 mt-12 pt-6 border-t border-border/30">
            Última atualização:{" "}
            {new Date(page.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "long", year: "numeric",
            })}
          </p>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Handify™ — Todos os direitos reservados
      </footer>
    </div>
  );
}
