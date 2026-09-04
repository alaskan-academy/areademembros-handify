import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { limpar, quebrar } from "@/lib/pdf/texto";
import { TAMANHOS, linhasRotulo, type DadosRotulo } from "./tipos";

/**
 * Folha A4 de rótulos para imprimir e recortar: a mesma etiqueta repetida na
 * grade que cabe no tamanho escolhido, com borda fina de corte. Se o texto não
 * couber, a fonte encolhe um pouco por vez (até 60%) antes de cortar.
 */

const CM = 28.3465;
const W = 595.28;
const H = 841.89;
const MARGEM = 1 * CM;
const GAP = 0.2 * CM;
const PAD = 0.28 * CM;

const INK = rgb(30 / 255, 30 / 255, 30 / 255);
const MUTED = rgb(95 / 255, 95 / 255, 95 / 255);
const CORTE = rgb(200 / 255, 200 / 255, 195 / 255);

type Linha = { texto: string; font: PDFFont; size: number; cor: ReturnType<typeof rgb>; antes: number };

export async function gerarFolhaRotulos(d: DadosRotulo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const t = TAMANHOS[d.tamanho];
  const w = t.w * CM;
  const h = t.h * CM;
  const cols = Math.max(1, Math.floor((W - 2 * MARGEM + GAP) / (w + GAP)));
  const rows = Math.max(1, Math.floor((H - 2 * MARGEM + GAP) / (h + GAP)));
  const porPagina = cols * rows;
  const larguraTexto = w - 2 * PAD;
  const alturaTexto = h - 2 * PAD;

  // Monta as linhas num fator de escala e mede a altura total.
  const montar = (f: number): { linhas: Linha[]; altura: number } => {
    const linhas: Linha[] = [];
    let altura = 0;
    for (const l of linhasRotulo(d)) {
      const cfg =
        l.papel === "marca"
          ? { font: bold, size: t.fontes.marca * f, cor: MUTED, antes: 0 }
          : l.papel === "produto"
            ? { font: bold, size: t.fontes.produto * f, cor: INK, antes: 1 * f }
            : l.papel === "destaque"
              ? { font: bold, size: t.fontes.texto * f, cor: INK, antes: 2.5 * f }
              : { font: regular, size: t.fontes.texto * f, cor: MUTED, antes: 2 * f };
      const quebradas = quebrar(l.texto, cfg.font, cfg.size, larguraTexto);
      quebradas.forEach((q, i) => {
        const antes = i === 0 ? cfg.antes : 0;
        linhas.push({ texto: q, ...cfg, antes });
        altura += antes + cfg.size * 1.18;
      });
    }
    return { linhas, altura };
  };

  let f = 1;
  let montado = montar(f);
  while (montado.altura > alturaTexto && f > 0.6) {
    f = Math.round((f - 0.06) * 100) / 100;
    montado = montar(f);
  }

  const total = Math.min(100, Math.max(1, d.quantidade));
  const paginas = Math.ceil(total / porPagina);
  let desenhados = 0;

  for (let p = 0; p < paginas; p++) {
    const page = doc.addPage([W, H]);
    for (let i = 0; i < porPagina && desenhados < total; i++, desenhados++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = MARGEM + col * (w + GAP);
      const yTopo = H - MARGEM - row * (h + GAP);
      page.drawRectangle({ x, y: yTopo - h, width: w, height: h, borderColor: CORTE, borderWidth: 0.5 });

      let y = yTopo - PAD;
      for (const l of montado.linhas) {
        y -= l.antes + l.size;
        if (y < yTopo - h + PAD - 0.5) break; // não couber mesmo encolhido: corta com dignidade
        page.drawText(limpar(l.texto), { x: x + PAD, y, size: l.size, font: l.font, color: l.cor });
        y -= l.size * 0.18;
      }
    }
    // rodapé discreto da folha
    const rod = `${limpar(d.produto || "Rótulos")} — ${total} rótulo${total !== 1 ? "s" : ""} de ${t.medida.replace("×", "x")} — feito com Handify™`;
    page.drawText(rod, { x: MARGEM, y: MARGEM * 0.45, size: 7, font: regular, color: CORTE });
  }

  return doc.save();
}
