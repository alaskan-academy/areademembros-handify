import { Resend } from "resend";

const FROM = "Handify <noreply@mail.handify.com.br>";
const REPLY_TO = "contato@handify.com.br";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://membros.handify.com.br";

// ─── Template base ────────────────────────────────────────────────────────────
// Otimizado para Gmail, Outlook 2007-2021, Apple Mail, Yahoo e mobile.
// Regras críticas:
// - bgcolor= attribute em todas as células coloridas (Outlook ignora CSS background)
// - font-family/size/color explícitos no <td> de conteúdo (Outlook não herda do body)
// - mso-table-lspace/rspace:0 em todas as tables (remove espaços fantasmas no Outlook)
// - Botão usa table com bgcolor (Outlook não respeita display:inline-block em <a>)
// - @media query para responsividade (Gmail suporta desde 2016)

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
* { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
body { margin: 0; padding: 0; background-color: #F5F5F0; }
table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
img { border: 0; display: block; outline: none; -ms-interpolation-mode: bicubic; }
a { text-decoration: none; }
@media only screen and (max-width: 640px) {
  .outer-td { padding: 20px 12px !important; }
  .card { width: 100% !important; border-radius: 0 !important; }
  .content-td { padding: 28px 24px !important; }
  .header-td { padding: 22px 24px !important; }
  .footer-td { padding: 16px 24px !important; }
  .btn-td { display: block !important; text-align: center !important; }
  h1 { font-size: 20px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F5F5F0;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td class="outer-td" align="center" style="padding:40px 16px;">

      <table class="card" width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#ffffff;border-radius:12px;overflow:hidden;mso-table-lspace:0pt;mso-table-rspace:0pt;">

        <!-- Faixa tricolor topo -->
        <tr>
          <td width="200" height="6" bgcolor="#6699F3" style="background-color:#6699F3;height:6px;line-height:6px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
          <td width="200" height="6" bgcolor="#72CF92" style="background-color:#72CF92;height:6px;line-height:6px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
          <td width="200" height="6" bgcolor="#FEC649" style="background-color:#FEC649;height:6px;line-height:6px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
        </tr>

        <!-- Header -->
        <tr>
          <td colspan="3" class="header-td" bgcolor="#0F0F0F" style="padding:28px 48px;background-color:#0F0F0F;font-family:Arial,Helvetica,sans-serif;">
            <span style="color:#6699F3;font-size:22px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1;mso-line-height-rule:exactly;">Handify&#8482;</span>
          </td>
        </tr>

        <!-- Conteúdo -->
        <tr>
          <td colspan="3" class="content-td" style="padding:36px 48px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#2D2D2D;line-height:1.6;mso-line-height-rule:exactly;">
            ${content}
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td colspan="3" class="footer-td" style="padding:20px 48px;border-top:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">
            <p style="color:#999999;font-size:12px;margin:0;line-height:1.6;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
              Handify&#8482; — Plataforma de Cursos de Artesanato<br>
              Este é um e-mail automático, não responda a esta mensagem.
            </p>
          </td>
        </tr>

        <!-- Faixa tricolor rodapé -->
        <tr>
          <td width="200" height="4" bgcolor="#6699F3" style="background-color:#6699F3;height:4px;line-height:4px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
          <td width="200" height="4" bgcolor="#72CF92" style="background-color:#72CF92;height:4px;line-height:4px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
          <td width="200" height="4" bgcolor="#FEC649" style="background-color:#FEC649;height:4px;line-height:4px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

function supportBlock() {
  return `<div style="border-top:1px solid #eeeeee;margin-top:28px;padding-top:18px;">
  <p style="color:#888888;font-size:13px;margin:0;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
    Precisa de ajuda? Fale com a gente:<br>
    <a href="mailto:contato@handify.com.br" style="color:#6699F3;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">contato@handify.com.br</a>
    &nbsp;|&nbsp;
    <a href="https://wa.me/554284296823" style="color:#6699F3;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">WhatsApp (42) 8429-6823</a>
  </p>
</div>`;
}

// Botão CTA com table — única forma confiável de ter fundo colorido + padding em Outlook.
// <a> com display:inline-block não funciona no Word engine do Outlook 2007-2021.
function ctaButton(href: string, label: string) {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:28px;">
  <tr>
    <td class="btn-td" bgcolor="#6699F3" style="background-color:#6699F3;border-radius:8px;text-align:center;mso-padding-alt:14px 32px;">
      <a href="${href}" style="display:inline-block;background-color:#6699F3;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;mso-line-height-rule:exactly;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

// Barra de progresso com table — div não renderiza corretamente no Outlook (Word engine).
function progressBar(pct: number) {
  const filled = Math.max(1, Math.min(pct, 99)); // garante ao menos 1px visível
  const empty = 100 - filled;
  return `<div style="background-color:#F5F5F0;border-radius:8px;padding:12px 16px;margin-bottom:28px;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
      <td width="${filled}%" height="8" bgcolor="#6699F3" style="background-color:#6699F3;height:8px;line-height:8px;font-size:0;mso-line-height-rule:exactly;border-radius:4px 0 0 4px;">&#8203;</td>
      <td width="${empty}%" height="8" bgcolor="#e0e0da" style="background-color:#e0e0da;height:8px;line-height:8px;font-size:0;mso-line-height-rule:exactly;border-radius:0 4px 4px 0;">&#8203;</td>
    </tr>
  </table>
  <p style="color:#555555;font-size:13px;margin:8px 0 0;text-align:right;font-family:Arial,Helvetica,sans-serif;">${pct}% concluído</p>
</div>`;
}

// ─── Boas-vindas ──────────────────────────────────────────────────────────────

export async function sendWelcomeEmail({
  to,
  studentName,
}: {
  to: string;
  studentName: string;
}): Promise<void> {
  const firstName = studentName.split(" ")[0];

  const { error } = await getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: "Bem-vinda à Handify! Um espaço feito para aprender e criar.",
    html: emailWrapper(`
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;mso-line-height-rule:exactly;">Bem-vinda, ${firstName}! 👋</h1>
      <p style="color:#2D2D2D;font-size:16px;line-height:1.65;margin:0 0 14px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Sua conta na Handify foi criada com sucesso. Um espaço feito para aprender e criar está esperando por você!
      </p>
      <p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 28px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Explore nossos cursos de artesanato e comece sua jornada criativa hoje mesmo.
      </p>
      ${ctaButton(`${appUrl()}/cursos`, "Explorar cursos")}
      ${supportBlock()}
    `),
  });

  if (error) {
    console.error("[email] welcome error:", error);
  }
}

// ─── Acesso confirmado (pós-compra) ───────────────────────────────────────────

export async function sendAccessConfirmedEmail({
  to,
  studentName,
  courseTitle,
  courseSlug,
  activationToken,
}: {
  to: string;
  studentName: string;
  courseTitle: string;
  courseSlug: string;
  activationToken?: string;
}): Promise<void> {
  const firstName = studentName.split(" ")[0];
  const courseUrl = activationToken
    ? `${appUrl()}/ativar/${activationToken}`
    : `${appUrl()}/cursos/${courseSlug}`;

  const { error } = await getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Seu acesso ao curso "${courseTitle}" foi liberado!`,
    html: emailWrapper(`
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;mso-line-height-rule:exactly;">
        Acesso liberado, ${firstName}! 🎉
      </h1>
      <p style="color:#2D2D2D;font-size:16px;line-height:1.65;margin:0 0 14px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Sua compra foi confirmada e o curso <strong>${courseTitle}</strong> já está disponível para você!
      </p>
      <p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 28px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        ${activationToken
          ? "Clique no botão abaixo para criar sua senha e acessar a plataforma. O link é pessoal e expira em 7 dias."
          : "Clique no botão abaixo para acessar o curso. Bons estudos!"}
      </p>
      ${ctaButton(courseUrl, activationToken ? "Criar minha conta e acessar" : "Acessar o curso")}
      ${supportBlock()}
    `),
  });

  if (error) {
    console.error("[email] access confirmed error:", error);
  }
}

// ─── Certificado disponível ───────────────────────────────────────────────────

export async function sendCertificateEmail({
  to,
  studentName,
  courseTitle,
  profileUrl,
}: {
  to: string;
  studentName: string;
  courseTitle: string;
  profileUrl: string;
}): Promise<void> {
  const firstName = studentName.split(" ")[0];

  const { error } = await getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Parabéns! Seu certificado de "${courseTitle}" está pronto`,
    html: emailWrapper(`
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;mso-line-height-rule:exactly;">
        Parabéns, ${firstName}! 🎓
      </h1>
      <p style="color:#2D2D2D;font-size:16px;line-height:1.65;margin:0 0 14px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Você concluiu o curso <strong>${courseTitle}</strong> com sucesso!
      </p>
      <p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 28px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Seu certificado já está disponível para download na plataforma. Você pode verificar, compartilhar e baixar a qualquer momento pela sua área de perfil.
      </p>
      ${ctaButton(profileUrl, "Ver meu certificado")}
      ${supportBlock()}
    `),
  });

  if (error) {
    console.error("[email] certificate error:", error);
  }
}

// ─── Lembrete de reengajamento (7 dias sem acesso) ────────────────────────────

export async function sendReengagementEmail({
  to,
  studentName,
  courseTitle,
  courseSlug,
  progressPercent,
}: {
  to: string;
  studentName: string;
  courseTitle: string;
  courseSlug: string;
  progressPercent: number;
}): Promise<void> {
  const firstName = studentName.split(" ")[0];
  const courseUrl = `${appUrl()}/cursos/${courseSlug}`;
  const pct = Math.round(progressPercent);

  const { error } = await getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `${firstName}, seu curso te espera! Você já está ${pct}% lá 🌟`,
    html: emailWrapper(`
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;mso-line-height-rule:exactly;">
        Olá, ${firstName}! Sentimos sua falta 💛
      </h1>
      <p style="color:#2D2D2D;font-size:16px;line-height:1.65;margin:0 0 14px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Faz alguns dias que você não acessa o curso <strong>${courseTitle}</strong>.
        Você já completou <strong>${pct}%</strong> — está tão perto!
      </p>
      <p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 20px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Continue de onde parou e mantenha o ritmo. Cada passo da jornada conta.
      </p>
      ${progressBar(pct)}
      ${ctaButton(courseUrl, "Continuar curso")}
      ${supportBlock()}
    `),
  });

  if (error) {
    console.error("[email] reengagement error:", error);
  }
}

// ─── Novo curso disponível ────────────────────────────────────────────────────

export async function sendNewCourseEmail({
  to,
  studentName,
  courseTitle,
  courseSlug,
  courseDescription,
  thumbnailUrl,
}: {
  to: string;
  studentName: string;
  courseTitle: string;
  courseSlug: string;
  courseDescription?: string;
  thumbnailUrl?: string | null;
}): Promise<void> {
  const firstName = studentName.split(" ")[0];
  const courseUrl = `${appUrl()}/cursos/${courseSlug}`;
  const imgBlock = thumbnailUrl
    ? `<img src="${thumbnailUrl}" alt="${courseTitle}" width="504" style="width:100%;max-width:504px;border-radius:8px;display:block;margin-bottom:20px;-ms-interpolation-mode:bicubic;" />`
    : "";

  const { error } = await getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Novo curso na Handify: ${courseTitle}`,
    html: emailWrapper(`
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;mso-line-height-rule:exactly;">
        Novo curso disponível, ${firstName}! ✨
      </h1>
      ${imgBlock}
      <p style="color:#2D2D2D;font-size:18px;font-weight:700;margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;line-height:1.4;mso-line-height-rule:exactly;">${courseTitle}</p>
      ${courseDescription ? `<p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 24px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">${courseDescription}</p>` : ""}
      <p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 28px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Confira o novo curso e comece a aprender quando quiser.
      </p>
      ${ctaButton(courseUrl, "Ver curso")}
      <p style="color:#cccccc;font-size:12px;margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;">
        <a href="${appUrl()}/perfil" style="color:#aaaaaa;text-decoration:underline;font-family:Arial,Helvetica,sans-serif;">Cancelar inscrição neste tipo de e-mail</a>
      </p>
      ${supportBlock()}
    `),
  });

  if (error) {
    console.error("[email] new course error:", error);
  }
}

// ─── Reembolso / cancelamento ────────────────────────────────────────────────

export async function sendRefundEmail({
  to,
  studentName,
  courseTitle,
}: {
  to: string;
  studentName: string;
  courseTitle: string;
}): Promise<void> {
  const firstName = studentName.split(" ")[0];
  const vitrineUrl = `${appUrl()}/vitrine`;

  const { error } = await getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: "Seu reembolso foi processado — a Handify continua aqui por você",
    html: emailWrapper(`
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;mso-line-height-rule:exactly;">
        Olá, ${firstName}!
      </h1>
      <p style="color:#2D2D2D;font-size:16px;line-height:1.65;margin:0 0 14px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Confirmamos que o reembolso do curso <strong>${courseTitle}</strong> foi processado com sucesso.
        Entendemos que às vezes o momento não é o ideal — e tudo bem!
      </p>
      <p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 14px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Quando você se sentir pronta para aprender e criar, a Handify vai estar aqui esperando por você.
        Nossos cursos foram feitos com muito carinho para acompanhar o seu ritmo — seja ele qual for.
      </p>
      <p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 28px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
        Dá uma espiada nos nossos cursos quando quiser — tem muita coisa bonita te esperando!
      </p>
      ${ctaButton(vitrineUrl, "Explorar cursos")}
      ${supportBlock()}
    `),
  });

  if (error) {
    console.error("[email] refund error:", error);
  }
}

// ─── Novo post no feed de notícias ────────────────────────────────────────────

export async function sendNewsPostEmail({
  to,
  studentName,
  postTitle,
  postBody,
  postId,
}: {
  to: string;
  studentName: string;
  postTitle: string;
  postBody?: string;
  postId: string;
}): Promise<void> {
  const firstName = studentName.split(" ")[0];
  const postUrl = `${appUrl()}/comunidade/feed`;
  const excerpt = postBody
    ? postBody.length > 200
      ? postBody.slice(0, 197) + "..."
      : postBody
    : "";

  const { error } = await getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Novidade na Handify: ${postTitle}`,
    html: emailWrapper(`
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;mso-line-height-rule:exactly;">
        Olá, ${firstName}! Tem novidade por aqui 📣
      </h1>
      <p style="color:#2D2D2D;font-size:18px;font-weight:700;margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;line-height:1.4;mso-line-height-rule:exactly;">${postTitle}</p>
      ${excerpt ? `<p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 24px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">${excerpt}</p>` : ""}
      ${ctaButton(postUrl, "Ver novidade")}
      <p style="color:#bbbbbb;font-size:12px;margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;line-height:1.6;mso-line-height-rule:exactly;">
        Para não receber e-mails de novidades, ajuste suas preferências na
        <a href="${appUrl()}/perfil" style="color:#6699F3;text-decoration:underline;">área de perfil</a>.
      </p>
      ${supportBlock()}
    `),
  });

  if (error) {
    console.error("[email] news post error:", error);
  }
}
