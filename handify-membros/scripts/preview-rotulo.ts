// Gera folhas de rótulos de exemplo para conferir o layout.
// Uso: npx tsx scripts/preview-rotulo.ts pasta-de-saida
import fs from "fs";
import path from "path";
import { gerarFolhaRotulos } from "../src/lib/rotulo/pdf";
import { dadosVazios, porFolha, type DadosRotulo } from "../src/lib/rotulo/tipos";

const base: DadosRotulo = {
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
  contato: "WhatsApp (41) 99999-0000 | @ateliedamaria",
};

const amostras: { nome: string; d: Partial<DadosRotulo> }[] = [
  { nome: "classico-9x5", d: { estilo: "classico", cor: "#8E7CC3", largura: 9, altura: 5 } },
  { nome: "moderno-9x7", d: { estilo: "moderno", cor: "#3F6F75", largura: 9, altura: 7, produto: "Manteiga corporal de karité", tipo: "Manteiga corporal", peso: "100 g" } },
  { nome: "delicado-7x4", d: { estilo: "delicado", cor: "#C98B8B", largura: 7, altura: 4 } },
  { nome: "redondo-7", d: { estilo: "delicado", cor: "#7FA37A", forma: "redondo", largura: 7, altura: 7, produto: "Hidratante de calêndula", tipo: "Hidratante corporal", peso: "60 g" } },
  { nome: "custom-12x8", d: { estilo: "classico", cor: "#B8963E", largura: 12, altura: 8 } },
];

const pasta = process.argv[2] ?? ".";
(async () => {
  for (const a of amostras) {
    const d = { ...base, ...a.d };
    d.quantidade = porFolha(d.largura, d.altura);
    const b = await gerarFolhaRotulos(d);
    fs.writeFileSync(path.join(pasta, `rotulos-${a.nome}.pdf`), b);
    console.log("ok", a.nome, b.length, "bytes", d.quantidade, "por folha");
  }
})();
