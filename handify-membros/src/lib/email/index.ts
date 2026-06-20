import { Resend } from "resend";

const FROM = "Handify <noreply@handify.com.br>";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

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
    to,
    subject: `Parabéns! Seu certificado de "${courseTitle}" está pronto`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <tr>
      <td width="200" height="6" style="background:#6699F3;font-size:0;line-height:0;">&nbsp;</td>
      <td width="200" height="6" style="background:#72CF92;font-size:0;line-height:0;">&nbsp;</td>
      <td width="200" height="6" style="background:#FEC649;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:36px 48px 0;background:#0F0F0F;">
        <span style="color:#6699F3;font-size:22px;font-weight:700;">Handify&#8482;</span>
      </td>
    </tr>
    <tr>
      <td colspan="3" style="padding:36px 48px;">
        <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 12px;font-weight:700;">
          Parabéns, ${firstName}! 🎉
        </h1>
        <p style="color:#2D2D2D;font-size:15px;line-height:1.65;margin:0 0 14px;">
          Você concluiu o curso <strong>${courseTitle}</strong> com sucesso!
        </p>
        <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 32px;">
          Seu certificado já está disponível para download na plataforma. Você pode verificar, compartilhar e baixar a qualquer momento pela sua área de perfil.
        </p>
        <a href="${profileUrl}" style="display:inline-block;background:#6699F3;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
          Ver meu certificado
        </a>
      </td>
    </tr>
    <tr>
      <td colspan="3" style="padding:20px 48px;border-top:1px solid #eee;">
        <p style="color:#999;font-size:11px;margin:0;line-height:1.5;">
          Handify&#8482; — Plataforma de Cursos de Artesanato<br>
          Este é um e-mail automático, não responda a esta mensagem.
        </p>
      </td>
    </tr>
    <tr>
      <td width="200" height="4" style="background:#6699F3;font-size:0;line-height:0;">&nbsp;</td>
      <td width="200" height="4" style="background:#72CF92;font-size:0;line-height:0;">&nbsp;</td>
      <td width="200" height="4" style="background:#FEC649;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>`,
  });

  if (error) {
    console.error("[email] certificate email error:", error);
  }
}

export async function sendWelcomeEmail({
  to,
  studentName,
}: {
  to: string;
  studentName: string;
}): Promise<void> {
  const firstName = studentName.split(" ")[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://membros.handify.com.br";

  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: "Bem-vinda à Handify! Um espaço feito para aprender e criar.",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
    <tr>
      <td width="200" height="6" style="background:#6699F3;">&nbsp;</td>
      <td width="200" height="6" style="background:#72CF92;">&nbsp;</td>
      <td width="200" height="6" style="background:#FEC649;">&nbsp;</td>
    </tr>
    <tr><td colspan="3" style="padding:36px 48px 0;background:#0F0F0F;">
      <span style="color:#6699F3;font-size:22px;font-weight:700;">Handify&#8482;</span>
    </td></tr>
    <tr><td colspan="3" style="padding:36px 48px;">
      <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 12px;">Bem-vinda, ${firstName}! 👋</h1>
      <p style="color:#2D2D2D;font-size:15px;line-height:1.65;margin:0 0 14px;">
        Sua conta na Handify foi criada com sucesso. Um espaço feito para aprender e criar está esperando por você!
      </p>
      <a href="${appUrl}/cursos" style="display:inline-block;background:#6699F3;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
        Explorar cursos
      </a>
    </td></tr>
    <tr><td colspan="3" style="padding:20px 48px;border-top:1px solid #eee;">
      <p style="color:#999;font-size:11px;margin:0;">Handify&#8482; — Plataforma de Cursos de Artesanato</p>
    </td></tr>
    <tr>
      <td width="200" height="4" style="background:#6699F3;">&nbsp;</td>
      <td width="200" height="4" style="background:#72CF92;">&nbsp;</td>
      <td width="200" height="4" style="background:#FEC649;">&nbsp;</td>
    </tr>
  </table>
</td></tr></table>
</body></html>`,
  });

  if (error) {
    console.error("[email] welcome email error:", error);
  }
}
