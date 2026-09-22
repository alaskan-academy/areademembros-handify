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
      // `attachment`, não `inline`: a aluna quer o arquivo salvo para imprimir.
      // Com `inline` o PDF abria no visualizador do celular, e o botão de salvar
      // de lá pede esta mesma URL outra vez — por GET.
      "Content-Disposition": `attachment; filename="rotulos-${nome || "produto"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * O PDF só existe a partir do formulário, então não há o que devolver aqui.
 * Mas sem este handler o Next responde 405, e o navegador pinta a tela de
 * erro dele — "Esta página não está funcionando", em inglês no rodapé, sem
 * saída. Foi o que uma aluna recebeu em 22/09/2026 depois de preencher o
 * rótulo inteiro. Aba velha, link salvo ou visualizador re-pedindo o arquivo
 * agora caem num recado que diz o que fazer.
 */
export async function GET() {
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Folha de rótulos — Handify™</title>
<style>
  body{margin:0;background:#F5F5F0;color:#2D2D2D;font:16px/1.6 Montserrat,Arial,Helvetica,sans-serif;
       display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .cartao{background:#fff;border:1px solid #E3E3DC;border-radius:12px;padding:28px 24px;max-width:420px;
          box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .faixa{display:flex;height:4px;border-radius:2px;overflow:hidden;margin-bottom:20px}
  .faixa span{flex:1}
  h1{font-size:20px;font-weight:700;margin:0 0 12px}
  p{margin:0 0 16px;color:#63635E}
  a{display:inline-block;background:#6699F3;color:#fff;text-decoration:none;font-weight:600;
    padding:12px 20px;border-radius:8px;min-height:44px;box-sizing:border-box}
</style></head><body>
  <div class="cartao">
    <div class="faixa"><span style="background:#6699F3"></span><span style="background:#72CF92"></span><span style="background:#FEC649"></span></div>
    <h1>A folha de rótulos é gerada na hora</h1>
    <p>Por isso este endereço não abre sozinho. Volte para a ferramenta e toque em
       <strong>Baixar folha de rótulos</strong> — o arquivo vai direto para os downloads
       do seu aparelho, e é de lá que você imprime.</p>
    <a href="/ferramentas/rotulo">Voltar para a ferramenta</a>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
