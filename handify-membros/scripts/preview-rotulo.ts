// Gera uma folha de rótulos de exemplo para conferir o layout.
// Uso: npx tsx scripts/preview-rotulo.ts saida.pdf [p|m|g]
import fs from "fs";
import { gerarFolhaRotulos } from "../src/lib/rotulo/pdf";
import { dadosVazios, porFolha, type Tamanho } from "../src/lib/rotulo/tipos";

const tamanho = (process.argv[3] as Tamanho) || "m";
gerarFolhaRotulos({
  ...dadosVazios(),
  marca: "Ateliê da Maria",
  produto: "Sabonete de lavanda",
  tipo: "Sabonete em barra",
  peso: "90 g",
  ingredientes: "Sodium Palmate, Sodium Cocoate, Aqua, Glycerin, Parfum, Lavandula Angustifolia Oil, Tocopherol, CI 77007",
  fabricacao: "2026-09-03",
  validade: "2027-09-03",
  lote: "0926-01",
  fabricante: "Maria Silva",
  documento: "CNPJ 00.000.000/0001-00",
  contato: "WhatsApp (41) 99999-0000 | @ateliedamaria | Curitiba, PR",
  tamanho,
  quantidade: porFolha(tamanho),
}).then((b) => {
  fs.writeFileSync(process.argv[2], b);
  console.log("ok", tamanho, b.length, "bytes", porFolha(tamanho), "por folha");
});
