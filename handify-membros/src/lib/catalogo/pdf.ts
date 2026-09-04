import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fs from "fs";
import path from "path";
import type { Marca } from "./actions";

/**
 * Tabela de preços em PDF — com a marca DELA no topo, e um "feito com
 * Handify™" discreto no rodapé. É o que ela manda para a cliente no WhatsApp;
 * por isso o layout é limpo, A4, sem nada da plataforma competindo com a marca
 * da aluna. Mesma fonte-base do certificado (Helvetica, embutida no pdf-lib).
 */

const BLUE = rgb(102 / 255, 153 / 255, 243 / 255);
const GREEN = rgb(114 / 255, 207 / 255, 146 / 255);
const YELLOW = rgb(254 / 255, 198 / 255, 73 / 255);
const INK = rgb(45 / 255, 45 / 255, 45 / 255);
const MUTED = rgb(120 / 255, 120 / 255, 120 / 255);
const LINE = rgb(228 / 255, 228 / 255, 222 / 255);
const WHITE = rgb(1, 1, 1);

const W = 595.28; // A4
const H = 841.89;
const M = 48; // margem

export type ItemPdf = { name: string; description: string | null; price: number };

const reais = (n: number) => "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Helvetica no pdf-lib usa WinAnsi: acentos, ç, —, ™ e aspas curvas entram;
 * emoji e afins não (e derrubam o encode). Tira só o que não dá para desenhar.
 */
function limpar(s: string): string {
  return s.replace(/[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, "").replace(/\s+/g, " ").trim();
}

function quebrar(texto: string, font: PDFFont, size: number, largura: number): string[] {
  const palavras = limpar(texto).split(" ");
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (font.widthOfTextAtSize(tentativa, size) <= largura) atual = tentativa;
    else {
      if (atual) linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function gerarCatalogoPdf(marca: Marca, itens: ItemPdf[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  let icon: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  try {
    icon = await doc.embedPng(fs.readFileSync(path.join(process.cwd(), "public", "icons", "icon-192x192.png")));
  } catch {
    icon = null;
  }

  const nomeMarca = limpar(marca.brand_name) || "Meu ateliê";
  const contatos = [
    marca.whatsapp && `WhatsApp ${marca.whatsapp}`,
    marca.instagram && (marca.instagram.startsWith("@") ? marca.instagram : `@${marca.instagram}`),
    marca.city,
  ]
    .filter(Boolean)
    .map((s) => limpar(String(s)))
    .join("   |   ");
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  let page: PDFPage;
  let y = 0;
  let numero = 0;

  const rodape = () => {
    page.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.5, color: LINE });
    page.drawText(`Tabela de preços — ${hoje}`, { x: M, y: 32, size: 8, font: regular, color: MUTED });
    const marcaTxt = "feito com Handify™";
    const tw = regular.widthOfTextAtSize(marcaTxt, 8);
    page.drawText(marcaTxt, { x: W - M - tw, y: 32, size: 8, font: regular, color: MUTED });
    if (icon) page.drawImage(icon, { x: W - M - tw - 14, y: 30, width: 11, height: 11 });
    page.drawText(String(numero), { x: W / 2 - 3, y: 32, size: 8, font: regular, color: MUTED });
  };

  const novaPagina = (primeira: boolean) => {
    page = doc.addPage([W, H]);
    numero += 1;
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: WHITE });
    // faixa tricolor no topo
    page.drawRectangle({ x: 0, y: H - 5, width: W / 3, height: 5, color: BLUE });
    page.drawRectangle({ x: W / 3, y: H - 5, width: W / 3, height: 5, color: GREEN });
    page.drawRectangle({ x: (W / 3) * 2, y: H - 5, width: W / 3 + 1, height: 5, color: YELLOW });

    y = H - 5 - 40;
    if (primeira) {
      const tamanho = nomeMarca.length > 26 ? 20 : 26;
      page.drawText(nomeMarca, { x: M, y, size: tamanho, font: bold, color: INK });
      y -= 18;
      if (marca.tagline) {
        page.drawText(limpar(marca.tagline), { x: M, y, size: 11, font: regular, color: MUTED });
        y -= 16;
      }
      if (contatos) {
        page.drawText(contatos, { x: M, y, size: 9.5, font: regular, color: MUTED });
        y -= 14;
      }
      y -= 10;
      page.drawText("TABELA DE PREÇOS", { x: M, y, size: 10, font: bold, color: BLUE });
      y -= 4;
      page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 1, color: BLUE });
      y -= 26;
    } else {
      page.drawText(nomeMarca, { x: M, y, size: 12, font: bold, color: INK });
      page.drawText("TABELA DE PREÇOS (continuação)", { x: M, y: y - 14, size: 8, font: regular, color: MUTED });
      y -= 40;
    }
    rodape();
  };

  novaPagina(true);

  const larguraNome = W - 2 * M - 110;
  for (const item of itens) {
    const linhasNome = quebrar(item.name, bold, 12, larguraNome);
    const linhasDesc = item.description ? quebrar(item.description, regular, 9, larguraNome) : [];
    // da primeira linha do nome até a última linha de texto do item
    const alturaTexto = (linhasNome.length - 1) * 15 + linhasDesc.length * 12;
    const altura = alturaTexto + 26; // + respiro, linha divisória e respiro
    if (y - altura < 60) novaPagina(false);

    let yl = y;
    for (const l of linhasNome) {
      page!.drawText(l, { x: M, y: yl, size: 12, font: bold, color: INK });
      yl -= 15;
    }
    for (const l of linhasDesc) {
      page!.drawText(l, { x: M, y: yl + 3, size: 9, font: regular, color: MUTED });
      yl -= 12;
    }
    const preco = reais(item.price);
    const pw = bold.widthOfTextAtSize(preco, 12);
    page!.drawText(preco, { x: W - M - pw, y, size: 12, font: bold, color: INK });

    const linha = y - alturaTexto - 9;
    page!.drawLine({ start: { x: M, y: linha }, end: { x: W - M, y: linha }, thickness: 0.5, color: LINE });
    y = linha - 17;
  }

  if (itens.length === 0) {
    page!.drawText("Nenhum produto ativo no catálogo.", { x: M, y, size: 11, font: regular, color: MUTED });
  }

  return doc.save();
}
