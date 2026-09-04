import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/access";
import { getToolsForViewer } from "@/lib/ferramentas/access";
import { rotuloSchema } from "@/lib/rotulo/tipos";
import { gerarFolhaRotulos } from "@/lib/rotulo/pdf";

/**
 * Folha de rótulos em PDF. Chega por POST de formulário (abre em outra aba no
 * celular sem bloqueio de pop-up). `/api/*` passa pelo proxy sem login, então
 * a checagem é aqui: sessão + a mesma regra de acesso da ferramenta.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId } = await getViewer();
  if (!userId) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });

  const dados = await getToolsForViewer();
  const tool = dados.tools.find((t) => t.slug === "rotulo-sabonete");
  if (!tool || tool.state !== "aberta") return NextResponse.json({ error: "Essa ferramenta abre com um curso de Saboaria ou Cosméticos." }, { status: 403 });

  const form = await req.formData();
  const raw = form.get("dados");
  if (typeof raw !== "string") return NextResponse.json({ error: "Dados do rótulo não vieram." }, { status: 400 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Dados do rótulo inválidos." }, { status: 400 });
  }
  const parsed = rotuloSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const pdf = await gerarFolhaRotulos(parsed.data);
  const nome = parsed.data.produto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="rotulos-${nome || "produto"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
