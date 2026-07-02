import { validateToken } from "./actions";
import ActivateForm from "./ActivateForm";
import { redirect } from "next/navigation";

export default async function AtivarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { email, defaultName, defaultPhone, error } = await validateToken(token);

  if (error || !email) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 w-full max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <span style={{ fontSize: 28 }}>⚠️</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground">Link inválido</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {error ?? "Este link não é válido."}
          </p>
          <a
            href="/login"
            className="inline-block mt-2 bg-[#6699F3] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#4d7de0] transition-colors"
          >
            Ir para o login
          </a>
        </div>
      </div>
    );
  }

  return <ActivateForm token={token} email={email} defaultName={defaultName} defaultPhone={defaultPhone} />;
}
