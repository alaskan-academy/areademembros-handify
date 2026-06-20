import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NovaAlunaForm from "./nova-aluna-form";

export default async function NovaAlunaPage() {
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

  return (
    <div className="max-w-md space-y-6">
      <Link
        href="/admin/alunos"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Alunas
      </Link>

      <div>
        <h1 className="text-xl font-bold">Nova aluna</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cria a conta manualmente. A aluna poderá acessar com este e-mail e senha.
        </p>
      </div>

      <NovaAlunaForm />
    </div>
  );
}
