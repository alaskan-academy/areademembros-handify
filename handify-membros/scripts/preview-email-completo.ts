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
// --conclusao: a versão que sai 2 h depois de a aluna concluir o primeiro curso.
const conclusao = process.argv.includes("--conclusao");

// Perfil típico do segmento-alvo (4–10 cursos, sem plano): 6 de 23.
const { subject, html } = renderPlanUpgradeEmail(conclusao ? {
  studentName: "Maria Aparecida Silva",
  cursosQueTem: ["Curso Saponaria Brasil"],
  totalDoPlano: 23,
  linkUrl: "https://pay.exemplo.com/handify-completo",
  momento: "conclusao",
  cursoConcluido: "Curso Saponaria Brasil",
} : {
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
