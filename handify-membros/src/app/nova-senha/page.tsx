import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NovaSenhaForm from "./nova-senha-form";

export default async function NovaSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sessão deve ter sido estabelecida pelo callback após clicar no link do e-mail.
  // Se não há sessão, o link expirou ou foi mal formado.
  if (!user) {
    redirect("/login?error=link-expirado");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-[#6699F3]">
            Handify™
          </span>
        </div>
        <NovaSenhaForm email={user.email ?? ""} />
      </div>
    </div>
  );
}
