import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { limpar } from "@/lib/pdf/texto";
import { linhasRotulo, fontes, type DadosRotulo, type Papel } from "./tipos";

/**
 * Folha A4 de rótulos para imprimir e recortar. Cada etiqueta tem moldura,
 * cor da aluna, marca em caixa alta espaçada, nome do produto grande (serifa
 * no Clássico e no Delicado) e o texto obrigatório pequeno. Retangular ou
 * redonda — na redonda, cada linha respeita a largura do círculo na altura em
 * que está. Se não couber, a letra encolhe um pouco por vez antes de cortar.
 */

const CM = 28.3465;
const W = 595.28;
const H = 841.89;
const MARGEM = 1 * CM;
const GAP = 0.2 * CM;

const INK = rgb(28 / 255, 28 / 255, 28 / 255);
const MUTED = rgb(88 / 255, 88 / 255, 88 / 255);
const BRANCO = rgb(1, 1, 1);

function hexRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Caminho SVG de retângulo com cantos redondos, origem no canto superior esquerdo. */
function cantosRedondos(w: number, h: number, r: number): string {
  return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

type Fontes = { sans: PDFFont; sansBold: PDFFont; serifBold: PDFFont; serifItalic: PDFFont };

type LinhaPosta = {
  texto: string;
  font: PDFFont;
  size: number;
  cor: RGB;
  /** topo da linha, medido do topo da etiqueta para baixo */
  yTop: number;
  centrada: boolean;
  espacada: boolean;
  divisoria?: boolean;
};

function larguraEspacada(texto: string, font: PDFFont, size: number, esp: number): number {
  let w = 0;
  for (const ch of texto) w += font.widthOfTextAtSize(ch, size) + esp;
  return w - esp;
}

function desenharEspacado(page: PDFPage, texto: string, x: number, y: number, font: PDFFont, size: number, cor: RGB, esp: number) {
  let cx = x;
  for (const ch of texto) {
    page.drawText(ch, { x: cx, y, size, font, color: cor });
    cx += font.widthOfTextAtSize(ch, size) + esp;
  }
}

export async function gerarFolhaRotulos(d: DadosRotulo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f: Fontes = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };

  const w = d.largura * CM;
  const h = d.altura * CM;
  const redondo = d.forma === "redondo";
  const accent = hexRgb(d.cor);
  const serif = d.estilo !== "moderno";
  const base = fontes(d.largura, d.altura, d.forma);
  const pad = Math.max(5, Math.min(w, h) * 0.075);
  const raio = Math.min(w, h) * 0.06;
  const r = w / 2; // redondo: largura = altura = diâmetro

  // Faixa do topo (Moderno, retangular): a marca vai nela, em branco.
  const temFaixa = d.estilo === "moderno" && !redondo && !!d.marca;
  const faixaH = temFaixa ? Math.max(base.marca * 2.4, h * 0.16) : 0;

  /** Largura disponível para uma linha cujo topo está em yTop (do topo para baixo). */
  const larguraEm = (yTop: number, size: number): number => {
    if (!redondo) return w - 2 * pad;
    const dy = yTop + size / 2 - r;
    const corda = 2 * Math.sqrt(Math.max(0, r * r - dy * dy));
    return Math.max(10, corda - 2 * pad - r * 0.1);
  };

  // Estilo por papel: fonte, tamanho, cor, alinhamento, respiro antes.
  const estiloDe = (papel: Papel, esc: number) => {
    const t = base.texto * esc;
    switch (papel) {
      case "marca":
        return { font: f.sansBold, size: base.marca * esc, cor: temFaixa ? BRANCO : accent, centrada: true, espacada: true, antes: 0 };
      case "produto":
        return { font: serif ? f.serifBold : f.sansBold, size: base.produto * esc, cor: INK, centrada: true, espacada: false, antes: t * 0.7 };
      case "tipo":
        return { font: d.estilo === "delicado" ? f.serifItalic : f.sans, size: t * 1.08, cor: accent, centrada: true, espacada: false, antes: t * 0.25 };
      case "texto":
        return { font: f.sans, size: t, cor: MUTED, centrada: redondo, espacada: false, antes: t * 0.55 };
      case "destaque":
        return { font: f.sansBold, size: t, cor: INK, centrada: true, espacada: false, antes: t * 0.8 };
      case "quem":
        return { font: f.sans, size: t * 0.95, cor: MUTED, centrada: true, espacada: false, antes: t * 0.4 };
    }
  };

  /** Monta as linhas já posicionadas para um fator de escala; devolve também onde termina. */
  const montar = (esc: number): { linhas: LinhaPosta[]; fim: number } => {
    const linhas: LinhaPosta[] = [];
    let y = redondo ? r * 0.2 + pad * 0.5 : temFaixa ? faixaH + pad * 0.8 : pad;
    const blocos = linhasRotulo(d);
    let divisoriaFeita = false;
    blocos.forEach((b, i) => {
      const s = estiloDe(b.papel, esc);
      const esp = s.espacada ? s.size * 0.18 : 0;
      const texto = s.espacada ? limpar(b.texto).toUpperCase() : limpar(b.texto);

      // Marca na faixa: fica centralizada verticalmente na faixa, fora do fluxo.
      if (b.papel === "marca" && temFaixa) {
        linhas.push({ texto, font: s.font, size: s.size, cor: s.cor, yTop: (faixaH - s.size) / 2, centrada: true, espacada: true });
        return;
      }

      // Divisória antes do primeiro texto miúdo (depois do nome/tipo).
      const primeiroTexto = b.papel === "texto" || b.papel === "destaque";
      if (primeiroTexto && !divisoriaFeita && i > 0) {
        divisoriaFeita = true;
        y += s.size * 0.6;
        linhas.push({ texto: "", font: s.font, size: s.size * 0.9, cor: accent, yTop: y, centrada: true, espacada: false, divisoria: true });
        y += s.size * 0.9;
      }

      y += s.antes;
      // Quebra palavra a palavra na largura disponível daquela altura.
      const palavras = texto.split(" ").filter(Boolean);
      let atual = "";
      const medir = (t: string) => (s.espacada ? larguraEspacada(t, s.font, s.size, esp) : s.font.widthOfTextAtSize(t, s.size));
      const fechar = () => {
        if (!atual) return;
        linhas.push({ texto: atual, font: s.font, size: s.size, cor: s.cor, yTop: y, centrada: s.centrada, espacada: s.espacada });
        y += s.size * 1.18;
        atual = "";
      };
      for (const p of palavras) {
        const tentativa = atual ? `${atual} ${p}` : p;
        if (medir(tentativa) <= larguraEm(y, s.size)) atual = tentativa;
        else {
          fechar();
          atual = p;
        }
      }
      fechar();
    });
    return { linhas, fim: y };
  };

  const limiteFim = redondo ? 2 * r - r * 0.2 - pad * 0.5 : h - pad;
  let esc = 1;
  let montado = montar(esc);
  while (montado.fim > limiteFim && esc > 0.55) {
    esc = Math.round((esc - 0.05) * 100) / 100;
    montado = montar(esc);
  }

  const cols = Math.max(1, Math.floor((W - 2 * MARGEM + GAP) / (w + GAP)));
  const rows = Math.max(1, Math.floor((H - 2 * MARGEM + GAP) / (h + GAP)));
  const porPagina = cols * rows;
  const total = Math.min(100, Math.max(1, d.quantidade));
  const paginas = Math.ceil(total / porPagina);
  let desenhados = 0;

  const desenharEtiqueta = (page: PDFPage, x: number, yTopo: number) => {
    const yBase = yTopo - h;
    // Fundo e moldura
    if (redondo) {
      if (d.estilo === "delicado") page.drawCircle({ x: x + r, y: yBase + r, size: r - 0.5, color: accent, opacity: 0.08 });
      page.drawCircle({ x: x + r, y: yBase + r, size: r - 0.6, borderColor: accent, borderWidth: d.estilo === "moderno" ? 2 : 0.7 });
      if (d.estilo === "classico") page.drawCircle({ x: x + r, y: yBase + r, size: r - 3.2, borderColor: accent, borderWidth: 0.5 });
    } else {
      if (d.estilo === "delicado") page.drawSvgPath(cantosRedondos(w - 1, h - 1, raio), { x: x + 0.5, y: yTopo - 0.5, color: accent, opacity: 0.08, borderWidth: 0 });
      page.drawSvgPath(cantosRedondos(w - 1, h - 1, raio), { x: x + 0.5, y: yTopo - 0.5, borderColor: accent, borderWidth: d.estilo === "moderno" ? 1.2 : 0.7 });
      if (d.estilo === "classico") page.drawSvgPath(cantosRedondos(w - 6.4, h - 6.4, Math.max(1, raio - 2.7)), { x: x + 3.2, y: yTopo - 3.2, borderColor: accent, borderWidth: 0.5 });
      if (temFaixa) {
        // faixa colorida colada no topo, respeitando os cantos redondos
        page.drawSvgPath(`M ${raio} 0 H ${w - 1 - raio} A ${raio} ${raio} 0 0 1 ${w - 1} ${raio} V ${faixaH} H 0 V ${raio} A ${raio} ${raio} 0 0 1 ${raio} 0 Z`, { x: x + 0.5, y: yTopo - 0.5, color: accent, borderWidth: 0 });
      }
    }
    // Linhas
    for (const l of montado.linhas) {
      const yLinha = yTopo - l.yTop - l.size; // baseline aproximada
      if (l.divisoria) {
        const comp = Math.min(larguraEm(l.yTop, l.size) * 0.35, 70);
        const cx = x + w / 2;
        const yc = yTopo - l.yTop - l.size * 0.45;
        if (d.estilo === "delicado") {
          page.drawLine({ start: { x: cx - comp / 2, y: yc }, end: { x: cx - 4, y: yc }, thickness: 0.5, color: accent });
          page.drawLine({ start: { x: cx + 4, y: yc }, end: { x: cx + comp / 2, y: yc }, thickness: 0.5, color: accent });
          page.drawCircle({ x: cx, y: yc, size: 1.3, color: accent });
        } else {
          page.drawLine({ start: { x: cx - comp / 2, y: yc }, end: { x: cx + comp / 2, y: yc }, thickness: d.estilo === "moderno" ? 1 : 0.5, color: accent });
        }
        continue;
      }
      const esp = l.espacada ? l.size * 0.18 : 0;
      const largura = l.espacada ? larguraEspacada(l.texto, l.font, l.size, esp) : l.font.widthOfTextAtSize(l.texto, l.size);
      const xLinha = l.centrada ? x + (w - largura) / 2 : x + pad;
      if (l.espacada) desenharEspacado(page, l.texto, xLinha, yLinha, l.font, l.size, l.cor, esp);
      else page.drawText(l.texto, { x: xLinha, y: yLinha, size: l.size, font: l.font, color: l.cor });
    }
  };

  for (let p = 0; p < paginas; p++) {
    const page = doc.addPage([W, H]);
    for (let i = 0; i < porPagina && desenhados < total; i++, desenhados++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      desenharEtiqueta(page, MARGEM + col * (w + GAP), H - MARGEM - row * (h + GAP));
    }
    const medida = redondo ? `${d.largura} cm de diâmetro` : `${d.largura} x ${d.altura} cm`;
    page.drawText(`${limpar(d.produto || "Rótulos")} — ${total} rótulo${total !== 1 ? "s" : ""} de ${medida} — feito com Handify™`, {
      x: MARGEM,
      y: MARGEM * 0.45,
      size: 7,
      font: f.sans,
      color: rgb(0.72, 0.72, 0.7),
    });
  }

  return doc.save();
}
