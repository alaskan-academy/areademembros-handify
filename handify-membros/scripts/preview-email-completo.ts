/**
 * Gera o e-mail de convite ao Handify Completo com dados de exemplo, para
 * aprovar o texto e o visual antes de configurar qualquer envio.
 *
 * Rodar com: npx tsx scripts/preview-email-completo.ts [caminho-de-saida.html]
 *
 * Não envia nada — só escreve o HTML e imprime o assunto.
 */
import { writeFileSync } from "node:fs";
import { renderPlanUpgradeEmail } from "../src/lib/email";

const saida = process.argv[2] ?? "preview-email-completo.html";

// Perfil típico do segmento-alvo (4–10 cursos, sem plano): 6 de 23.
const { subject, html } = renderPlanUpgradeEmail({
  studentName: "Maria Aparecida Silva",
  cursosQueTem: [
    "Curso Saponaria Brasil",
    "Workshop Buquê de Velas",
    "Curso Fábrica das Velas de Lembrancinha",
    "Livro Digital: Embalagens que Encantam",
    "Curso Vendas no Artesanato na Prática",
    "Curso Velaroma Artesanal",
  ],
  totalDoPlano: 23,
  linkUrl: "https://pay.exemplo.com/handify-completo",
  buttonText: "Ver o Handify Completo",
});

writeFileSync(saida, html, "utf8");
console.log(`Assunto: ${subject}`);
console.log(`HTML: ${saida}`);
