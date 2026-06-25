import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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

export default async function NovaPaginaPage() {
  await assertAdmin();

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
          <h1 className="text-xl font-bold text-[#2D2D2D]">Nova Página</h1>
          <p className="text-sm text-foreground/50">Crie uma página estática de conteúdo</p>
        </div>
      </div>

      <PaginaFormClient id={null} />
    </div>
  );
}
