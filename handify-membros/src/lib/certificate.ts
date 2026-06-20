import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { DANCING_SCRIPT_BOLD } from "@/lib/fonts/dancing-script-bold";

interface CertificateData {
  studentName: string;
  cpf?: string | null;
  courseTitle: string;
  workloadHours: number;
  issuedAt: Date;
  verifyHash: string;
}

const BLUE        = rgb(102 / 255, 153 / 255, 243 / 255);
const GREEN       = rgb(114 / 255, 207 / 255, 146 / 255);
const YELLOW      = rgb(254 / 255, 198 / 255, 73 / 255);
const BRAND_BLACK = rgb(15 / 255, 15 / 255, 15 / 255);
const DARK_GRAY   = rgb(45 / 255, 45 / 255, 45 / 255);
const MID_GRAY    = rgb(120 / 255, 120 / 255, 120 / 255);
const LIGHT_GRAY  = rgb(165 / 255, 165 / 255, 165 / 255);
const PANEL_SEP   = rgb(40 / 255, 40 / 255, 40 / 255);
const WHITE       = rgb(1, 1, 1);
const SOFT_BLUE   = rgb(230 / 255, 238 / 255, 255 / 255);

export async function generateCertificatePdf(
  data: CertificateData
): Promise<Uint8Array> {
  const { studentName, cpf, courseTitle, workloadHours, issuedAt, verifyHash } = data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://membros.handify.com.br";
  const verifyUrl = `${appUrl}/verificar/${verifyHash}`;

  // QR code com fundo branco e cor escura
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    width: 120,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0F0F0F", light: "#FFFFFF" },
  });

  const pdfDoc = await PDFDocument.create();
  const W = 841.89;
  const H = 595.28;
  const page = pdfDoc.addPage([W, H]);

  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Fonte cursiva para assinatura — Amsterdam One embutida como base64
  let cursive;
  try {
    cursive = await pdfDoc.embedFont(Buffer.from(DANCING_SCRIPT_BOLD, "base64"));
  } catch (fontErr) {
    console.error("[cert] embedFont Amsterdam One failed:", fontErr);
    cursive = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  }

  // ── Fundo branco base ───────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: WHITE });

  // ── Painel esquerdo escuro ──────────────────────────────────────────────────
  const panelW = 205;
  page.drawRectangle({ x: 0, y: 0, width: panelW, height: H, color: BRAND_BLACK });

  // Detalhe: linha azul na borda direita do painel
  page.drawRectangle({ x: panelW - 3, y: 0, width: 3, height: H, color: BLUE });

  // ── Faixas tricolores (topo e base) ────────────────────────────────────────
  const stripeH = 8;
  for (const y of [H - stripeH, 0]) {
    page.drawRectangle({ x: 0,           y, width: W / 3,     height: stripeH, color: BLUE });
    page.drawRectangle({ x: W / 3,       y, width: W / 3,     height: stripeH, color: GREEN });
    page.drawRectangle({ x: (W / 3) * 2, y, width: W / 3 + 2, height: stripeH, color: YELLOW });
  }

  // ── Watermark decorativo (círculo suave no painel direito) ─────────────────
  const circX = W - 110;
  const circY = H / 2;
  page.drawEllipse({ x: circX, y: circY, xScale: 155, yScale: 155, color: SOFT_BLUE });
  page.drawEllipse({ x: circX, y: circY, xScale: 140, yScale: 140, color: WHITE });
  page.drawEllipse({ x: circX, y: circY, xScale: 135, yScale: 135, color: SOFT_BLUE, borderColor: SOFT_BLUE, borderWidth: 1 });
  page.drawEllipse({ x: circX, y: circY, xScale: 120, yScale: 120, color: WHITE });

  // ── Logo no painel esquerdo ─────────────────────────────────────────────────
  const logoY = H - 72;

  // Tenta incorporar o ícone PNG do projeto
  try {
    const iconPath = path.join(process.cwd(), "public", "icon.png");
    const iconBytes = fs.readFileSync(iconPath);
    const icon = await pdfDoc.embedPng(iconBytes);
    const iconSize = 32;
    page.drawImage(icon, { x: 18, y: logoY - 2, width: iconSize, height: iconSize });
    page.drawText("Handify™", {
      x: 56, y: logoY + 10, size: 19, font: bold, color: BLUE,
    });
  } catch {
    page.drawText("Handify™", {
      x: 18, y: logoY + 10, size: 22, font: bold, color: BLUE,
    });
  }

  // Linha divisória sutil
  page.drawRectangle({ x: 18, y: logoY - 8, width: panelW - 36, height: 1, color: PANEL_SEP });

  page.drawText("Plataforma de Cursos", {
    x: 18, y: logoY - 22, size: 8, font: regular, color: LIGHT_GRAY,
  });
  page.drawText("de Artesanato", {
    x: 18, y: logoY - 33, size: 8, font: regular, color: LIGHT_GRAY,
  });

  // ── QR Code centralizado no painel ─────────────────────────────────────────
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const qrSize = 96;
  const qrX = (panelW - qrSize) / 2;
  const qrY = stripeH + 54;

  // Fundo branco ao redor do QR
  page.drawRectangle({ x: qrX - 4, y: qrY - 4, width: qrSize + 8, height: qrSize + 8, color: WHITE });
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  page.drawText("Verificar autenticidade:", {
    x: 14, y: qrY - 16, size: 7, font: regular, color: LIGHT_GRAY,
  });
  const shortUrl = verifyUrl.replace(/^https?:\/\//, "").slice(0, 34);
  page.drawText(shortUrl, {
    x: 14, y: qrY - 27, size: 6, font: regular, color: MID_GRAY,
  });

  // ── Área de conteúdo (painel direito) ──────────────────────────────────────
  const cx = panelW + 38;
  const cw = W - cx - 30;

  // Título do certificado
  page.drawText("CERTIFICADO DE CONCLUSÃO", {
    x: cx, y: H - 44, size: 13.5, font: bold, color: BLUE,
  });
  // Sublinhado azul
  page.drawRectangle({ x: cx, y: H - 53, width: 248, height: 2, color: BLUE });
  // Linha cinza complementar
  page.drawRectangle({ x: cx + 250, y: H - 54, width: cw - 250, height: 0.5, color: rgb(0.85, 0.85, 0.85) });

  // "Certificamos que"
  page.drawText("Certificamos que", {
    x: cx, y: H - 92, size: 11, font: regular, color: MID_GRAY,
  });

  // Nome do aluno — tamanho adaptativo
  const nameFontSize = studentName.length > 44 ? 20
    : studentName.length > 32 ? 24
    : studentName.length > 22 ? 28
    : 32;

  page.drawText(studentName.toUpperCase(), {
    x: cx, y: H - 130, size: nameFontSize, font: bold, color: DARK_GRAY, maxWidth: cw,
  });

  let contentY = H - 168;

  // CPF (se disponível)
  if (cpf) {
    page.drawText(`CPF: ${cpf}`, {
      x: cx, y: contentY, size: 9.5, font: regular, color: LIGHT_GRAY,
    });
    contentY -= 20;
  }

  // Pequeno divisor antes de "concluiu"
  page.drawRectangle({ x: cx, y: contentY + 8, width: 36, height: 2, color: BLUE });
  contentY -= 10;

  page.drawText("concluiu com êxito o curso", {
    x: cx, y: contentY, size: 11, font: regular, color: MID_GRAY,
  });
  contentY -= 30;

  // Nome do curso
  const courseFontSize = courseTitle.length > 55 ? 14
    : courseTitle.length > 38 ? 17
    : 20;
  page.drawText(courseTitle, {
    x: cx, y: contentY, size: courseFontSize, font: bold, color: DARK_GRAY, maxWidth: cw,
  });
  contentY -= (courseTitle.length > 38 ? 42 : 36);

  // Linha divisória fina
  page.drawRectangle({ x: cx, y: contentY + 10, width: cw - 10, height: 0.5, color: rgb(0.88, 0.88, 0.88) });
  contentY -= 6;

  // Carga horária e data
  const dateStr = issuedAt.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  page.drawText(`Carga horária: ${workloadHours} hora${workloadHours !== 1 ? "s" : ""}`, {
    x: cx, y: contentY, size: 9.5, font: regular, color: MID_GRAY,
  });
  page.drawText(`Emitido em: ${dateStr}`, {
    x: cx, y: contentY - 14, size: 9.5, font: regular, color: MID_GRAY,
  });

  // ── Assinatura ─────────────────────────────────────────────────────────────
  const sigY = stripeH + 44;

  // Texto cursivo ACIMA da linha
  page.drawText("Handify", {
    x: cx + 2, y: sigY + 38, size: 26, font: cursive, color: DARK_GRAY,
  });
  // "™" em fonte regular ao lado do cursivo
  page.drawText("™", {
    x: cx + 88, y: sigY + 52, size: 9, font: bold, color: DARK_GRAY,
  });

  // Linha de assinatura abaixo do texto cursivo
  page.drawRectangle({ x: cx, y: sigY + 28, width: 170, height: 1, color: DARK_GRAY });

  page.drawText("Plataforma de Cursos de Artesanato", {
    x: cx, y: sigY + 14, size: 7.5, font: regular, color: LIGHT_GRAY,
  });

  return pdfDoc.save();
}
