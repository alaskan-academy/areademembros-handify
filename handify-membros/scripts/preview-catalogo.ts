// Gera um PDF de exemplo do catálogo para conferir o layout (paginação, quebra de linha).
// Uso: npx tsx scripts/preview-catalogo.ts saida.pdf
import fs from "fs";
import { gerarCatalogoPdf } from "../src/lib/catalogo/pdf";

const itens = Array.from({ length: 34 }, (_, i) => ({
  name: i % 5 === 0 ? `Kit presente com três velas aromáticas de soja e caixa personalizada número ${i + 1}` : `Produto ${i + 1}`,
  description:
    i % 3 === 0
      ? "Cera de soja, pavio de algodão, 40 h de queima, aroma de lavanda com toque de baunilha e embalagem em vidro reutilizável"
      : i % 3 === 1
        ? "Sabonete artesanal 90 g"
        : null,
  price: 1234.5 / (i + 1) + 9.9,
}));

gerarCatalogoPdf(
  { brand_name: "Ateliê Teste Handify", tagline: "Velas e sabonetes feitos à mão", whatsapp: "(41) 99999-0000", instagram: "atelieteste", city: "Curitiba, PR" },
  itens
).then((b) => {
  fs.writeFileSync(process.argv[2], b);
  console.log("ok", b.length, "bytes");
});
