/**
 * Gera um certificado de exemplo em arquivo, para olhar o resultado antes de
 * mexer no layout. Não toca em nada de aluna real.
 *
 *   npx tsx scripts/gerar-certificado-teste.ts
 *   npx tsx scripts/gerar-certificado-teste.ts --guias
 *
 * Com `--guias`, desenha por cima a zona que a impressora doméstica NÃO
 * imprime (10mm de cada borda, que é o pior caso comum). Serve para conferir
 * de olho que nenhum texto, logo ou QR cai ali — foi esse corte que fez o
 * certificado de uma aluna sair pela metade em 21/09/2026.
 */
import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import { generateCertificatePdf } from "../src/lib/certificate";

/** Zona morta de impressora doméstica no pior caso comum. */
const NAO_IMPRIMIVEL_MM = 10;
const MM = 2.8346; // 1mm em pontos

async function comGuiasDeCorte(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPage(0);
  const { width: W, height: H } = page.getSize();
  const m = NAO_IMPRIMIVEL_MM * MM;
  const vermelho = rgb(1, 0, 0);
  const opacity = 0.35;

  // Faixas cobrindo o que a impressora comeria
  page.drawRectangle({ x: 0, y: 0, width: W, height: m, color: vermelho, opacity });
  page.drawRectangle({ x: 0, y: H - m, width: W, height: m, color: vermelho, opacity });
  page.drawRectangle({ x: 0, y: 0, width: m, height: H, color: vermelho, opacity });
  page.drawRectangle({ x: W - m, y: 0, width: m, height: H, color: vermelho, opacity });

  return doc.save();
}

async function main() {
  const guias = process.argv.includes("--guias");

  let pdf = await generateCertificatePdf({
    studentName: "Rosangela Rodrigues de Oliveira Guimaraes",
    cpf: "123.456.789-09",
    courseTitle: "Curso Fábrica das Velas de Lembrancinha",
    workloadHours: 12,
    issuedAt: new Date("2026-09-20T12:00:00Z"),
    verifyHash: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  });

  if (guias) pdf = await comGuiasDeCorte(pdf);

  const nome = guias ? "certificado-teste-guias.pdf" : "certificado-teste.pdf";
  const destino = path.join(process.cwd(), nome);
  fs.writeFileSync(destino, pdf);
  console.log("PDF salvo em:", destino, `(${(pdf.length / 1024).toFixed(0)} KB)`);
  if (guias) {
    console.log(`A faixa vermelha é o que a impressora corta (${NAO_IMPRIMIVEL_MM}mm).`);
    console.log("Nenhum texto, logo ou QR pode encostar nela.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
