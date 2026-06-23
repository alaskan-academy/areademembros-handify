import { Resend } from "resend";

const FROM = "Handify <noreply@mail.handify.com.br>";
const REPLY_TO = "contato@handify.com.br";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://membros.handify.com.br";

// ─── Template base ────────────────────────────────────────────────────────────

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <tr>
      <td width="200" height="6" style="background:#6699F3;font-size:0;line-height:0;">&nbsp;</td>
      <td width="200" height="6" style="background:#72CF92;font-size:0;line-height:0;">&nbsp;</td>
      <td width="200" height="6" style="background:#FEC649;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr><td colspan="3" style="padding:28px 48px 0;background:#0F0F0F;">
      <span style="color:#6699F3;font-size:22px;font-weight:700;">Handify&#8482;</span>
    </td></tr>
    <tr><td colspan="3" style="padding:32px 48px;">
      ${content}
    </td></tr>
    <tr><td colspan="3" style="padding:20px 48px;border-top:1px solid #eee;">
      <p style="color:#999;font-size:11px;margin:0;line-height:1.5;">
        Handify&#8482; — Plataforma de Cursos de Artesanato<br>
        Este é um e-mail automático, não responda a esta mensagem.
      </p>
    </td></tr>
    <tr>
      <td width="200" height="4" style="background:#6699F3;font-size:0;line-height:0;">&nbsp;</td>
      <td width="200" height="4" style="background:#72CF92;font-size:0;line-height:0;">&nbsp;</td>
      <td width="200" height="4" style="background:#FEC649;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
  </table>
</td></tr></table>
</body></html>`;
}

function ctaButton(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#6699F3;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">${label}</a>`;
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
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 12px;font-weight:700;">Bem-vinda, ${firstName}! 👋</h1>
      <p style="color:#2D2D2D;font-size:15px;line-height:1.65;margin:0 0 14px;">
        Sua conta na Handify foi criada com sucesso. Um espaço feito para aprender e criar está esperando por você!
      </p>
      <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 28px;">
        Explore nossos cursos de artesanato e comece sua jornada criativa hoje mesmo.
      </p>
      ${ctaButton(`${appUrl()}/cursos`, "Explorar cursos")}
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
}: {
  to: string;
  studentName: string;
  courseTitle: string;
  courseSlug: string;
}): Promise<void> {
  const firstName = studentName.split(" ")[0];
  const courseUrl = `${appUrl()}/cursos/${courseSlug}`;

  const { error } = await getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Seu acesso ao curso "${courseTitle}" foi liberado!`,
    html: emailWrapper(`
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 12px;font-weight:700;">
        Acesso liberado, ${firstName}! 🎉
      </h1>
      <p style="color:#2D2D2D;font-size:15px;line-height:1.65;margin:0 0 14px;">
        Sua compra foi confirmada e o curso <strong>${courseTitle}</strong> já está disponível na sua conta.
      </p>
      <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 28px;">
        Clique no botão abaixo para começar a aprender agora mesmo. Bons estudos!
      </p>
      ${ctaButton(courseUrl, "Acessar o curso")}
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
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 12px;font-weight:700;">
        Parabéns, ${firstName}! 🎓
      </h1>
      <p style="color:#2D2D2D;font-size:15px;line-height:1.65;margin:0 0 14px;">
        Você concluiu o curso <strong>${courseTitle}</strong> com sucesso!
      </p>
      <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 28px;">
        Seu certificado já está disponível para download na plataforma. Você pode verificar, compartilhar e baixar a qualquer momento pela sua área de perfil.
      </p>
      ${ctaButton(profileUrl, "Ver meu certificado")}
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
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 12px;font-weight:700;">
        Olá, ${firstName}! Sentimos sua falta 💛
      </h1>
      <p style="color:#2D2D2D;font-size:15px;line-height:1.65;margin:0 0 14px;">
        Faz alguns dias que você não acessa o curso <strong>${courseTitle}</strong>.
        Você já completou <strong>${pct}%</strong> — está tão perto!
      </p>
      <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 20px;">
        Continue de onde parou e mantenha o ritmo. Cada passo da jornada conta.
      </p>
      <div style="background:#F5F5F0;border-radius:8px;padding:12px 16px;margin-bottom:28px;">
        <div style="background:#e8e8e3;border-radius:4px;height:8px;overflow:hidden;">
          <div style="background:#6699F3;height:8px;width:${pct}%;border-radius:4px;"></div>
        </div>
        <p style="color:#555;font-size:12px;margin:8px 0 0;text-align:right;">${pct}% concluído</p>
      </div>
      ${ctaButton(courseUrl, "Continuar curso")}
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
    ? `<img src="${thumbnailUrl}" alt="${courseTitle}" width="504" style="width:100%;border-radius:8px;display:block;margin-bottom:20px;" />`
    : "";

  const { error } = await getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Novo curso na Handify: ${courseTitle}`,
    html: emailWrapper(`
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 12px;font-weight:700;">
        Novo curso disponível, ${firstName}! ✨
      </h1>
      ${imgBlock}
      <p style="color:#2D2D2D;font-size:18px;font-weight:600;margin:0 0 10px;">${courseTitle}</p>
      ${courseDescription ? `<p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 24px;">${courseDescription}</p>` : ""}
      <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 28px;">
        Confira o novo curso e comece a aprender quando quiser.
      </p>
      ${ctaButton(courseUrl, "Ver curso")}
      <p style="color:#ddd;font-size:10px;margin:20px 0 0;">
        <a href="${appUrl()}/perfil" style="color:#ccc;text-decoration:none;">Cancelar inscrição</a>
      </p>
    `),
  });

  if (error) {
    console.error("[email] new course error:", error);
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
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 12px;font-weight:700;">
        Olá, ${firstName}! Tem novidade por aqui 📣
      </h1>
      <p style="color:#2D2D2D;font-size:17px;font-weight:600;margin:0 0 10px;">${postTitle}</p>
      ${excerpt ? `<p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 24px;">${excerpt}</p>` : ""}
      ${ctaButton(postUrl, "Ver novidade")}
      <p style="color:#bbb;font-size:11px;margin:24px 0 0;">
        Para não receber e-mails de novidades, ajuste suas preferências na
        <a href="${appUrl()}/perfil" style="color:#6699F3;">área de perfil</a>.
      </p>
    `),
  });

  if (error) {
    console.error("[email] news post error:", error);
  }
}
