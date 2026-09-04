import type { PDFFont } from "pdf-lib";

/**
 * Texto para os PDFs feitos com as fontes padrão do pdf-lib (Helvetica).
 * WinAnsi cobre acentos, ç, —, ™ e aspas curvas; emoji e afins não (e derrubam
 * o encode). `limpar` tira só o que não dá para desenhar.
 */
export function limpar(s: string): string {
  return s.replace(/[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, "").replace(/\s+/g, " ").trim();
}

/** Quebra em linhas que cabem na largura, palavra por palavra. */
export function quebrar(texto: string, font: PDFFont, size: number, largura: number): string[] {
  const palavras = limpar(texto).split(" ").filter(Boolean);
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
