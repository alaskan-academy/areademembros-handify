/**
 * Envia e-mails de migração para candidatas não ativadas.
 *
 * Uso:
 *   npx tsx scripts/send-migration-emails.ts [--dry-run] [--limit N]
 *
 * Flags:
 *   --dry-run   Lista candidatas mas não envia e-mails
 *   --limit N   Processa no máximo N candidatas (útil para teste)
 *
 * Rate limit Resend: 100 e-mails/seg → enviamos 100 por lote com 1s de pausa.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://membros.handify.com.br";

const FROM = "Handify <noreply@mail.handify.com.br>";
const REPLY_TO = "contato@handify.com.br";
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 1100; // ~100/s com margem

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit=")) ?? args[args.indexOf("--limit") + 1];
const LIMIT = limitArg && !isNaN(Number(limitArg)) ? Number(limitArg) : null;

// ─── Template do e-mail ───────────────────────────────────────────────────────

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
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
<body style="margin:0;padding:0;background-color:#F5F5F0;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F5F5F0;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td class="outer-td" align="center" style="padding:40px 16px;">
      <table class="card" width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#ffffff;border-radius:12px;overflow:hidden;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td width="200" height="6" bgcolor="#6699F3" style="background-color:#6699F3;height:6px;line-height:6px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
          <td width="200" height="6" bgcolor="#72CF92" style="background-color:#72CF92;height:6px;line-height:6px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
          <td width="200" height="6" bgcolor="#FEC649" style="background-color:#FEC649;height:6px;line-height:6px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
        </tr>
        <tr>
          <td colspan="3" class="header-td" bgcolor="#0F0F0F" style="padding:28px 48px;background-color:#0F0F0F;font-family:Arial,Helvetica,sans-serif;">
            <span style="color:#6699F3;font-size:22px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1;mso-line-height-rule:exactly;">Handify&#8482;</span>
          </td>
        </tr>
        <tr>
          <td colspan="3" class="content-td" style="padding:36px 48px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#2D2D2D;line-height:1.6;mso-line-height-rule:exactly;">
            ${content}
          </td>
        </tr>
        <tr>
          <td colspan="3" class="footer-td" style="padding:20px 48px;border-top:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">
            <p style="color:#999999;font-size:12px;margin:0;line-height:1.6;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
              Handify&#8482; — Plataforma de Cursos de Artesanato<br>
              Este é um e-mail automático, não responda a esta mensagem.<br>
              Dúvidas? Fale com a gente: <a href="mailto:contato@handify.com.br" style="color:#6699F3;text-decoration:none;">contato@handify.com.br</a>
            </p>
          </td>
        </tr>
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

function buildMigrationEmail(firstName: string, email: string) {
  const ativarUrl = `${APP_URL}/ativar`;

  const html = emailWrapper(`
    <h1 style="color:#2D2D2D;font-size:22px;margin:0 0 16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;mso-line-height-rule:exactly;">
      ${firstName ? `${firstName}, sua` : "Sua"} área de membros Handify está pronta! 🎉
    </h1>
    <p style="color:#2D2D2D;font-size:16px;line-height:1.65;margin:0 0 14px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
      Você comprou um curso da Handify e migramos sua conta para a nossa nova plataforma de aulas — mais completa, mais bonita e feita especialmente para você criar e aprender!
    </p>
    <p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 14px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
      Para acessar seus cursos, basta criar uma senha rápida. Clique no botão abaixo e use o e-mail <strong>${email}</strong> — o mesmo que você usou na compra.
    </p>
    <p style="color:#555555;font-size:15px;line-height:1.65;margin:0 0 28px;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">
      É só uma vez! Depois disso, você entra com e-mail e senha normalmente.
    </p>
    ${ctaButton(ativarUrl, "Ativar minha conta agora")}
    <div style="background-color:#F5F5F0;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="color:#555555;font-size:13px;margin:0;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
        <strong>Como funciona:</strong><br>
        1. Clique no botão acima<br>
        2. Digite o e-mail <strong>${email}</strong><br>
        3. Crie sua senha e pronto — seus cursos estarão esperando por você!
      </p>
    </div>
    <p style="color:#888888;font-size:13px;line-height:1.6;margin:0;font-family:Arial,Helvetica,sans-serif;">
      Precisa de ajuda? Responda este e-mail ou fale com a gente pelo
      <a href="https://wa.me/554284296823" style="color:#6699F3;text-decoration:none;">WhatsApp (42) 8429-6823</a>.
    </p>
  `);

  const subject = firstName
    ? `${firstName}, sua área de membros Handify está pronta!`
    : "Sua área de membros Handify está pronta!";

  return { html, subject };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

void (async () => {
  // Valida variáveis de ambiente
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"].filter(
    (k) => !process.env[k]
  );
  if (missing.length > 0) {
    console.error(`❌ Variáveis de ambiente ausentes: ${missing.join(", ")}`);
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const resend = new Resend(RESEND_API_KEY);

  console.log(`\n📧 Script de e-mails de migração${DRY_RUN ? " [DRY-RUN]" : ""}`);
  if (LIMIT) console.log(`   Limite: ${LIMIT} candidatas`);
  console.log(`   App URL: ${APP_URL}\n`);

  // Busca candidatas não ativadas
  let query = supabase
    .from("migration_candidates")
    .select("id, email, full_name")
    .is("activated_at", null)
    .order("created_at");

  if (LIMIT) query = query.limit(LIMIT);

  const { data: candidates, error: fetchError } = await query;

  if (fetchError) {
    console.error("❌ Erro ao buscar candidatas:", fetchError.message);
    process.exit(1);
  }

  if (!candidates || candidates.length === 0) {
    console.log("✅ Nenhuma candidata pendente encontrada.");
    return;
  }

  console.log(`📋 ${candidates.length} candidata(s) para receber e-mail\n`);

  if (DRY_RUN) {
    console.log("Primeiras 10 candidatas:");
    candidates.slice(0, 10).forEach((c) => {
      console.log(`  • ${c.email} — ${c.full_name ?? "(sem nome)"}`);
    });
    if (candidates.length > 10) {
      console.log(`  … e mais ${candidates.length - 10}`);
    }
    console.log("\n[DRY-RUN] Nenhum e-mail enviado.");
    return;
  }

  // Confirmação antes de disparar
  console.log(`⚠️  Prestes a enviar ${candidates.length} e-mails.`);
  console.log("   Pressione Ctrl+C para cancelar ou aguarde 5s para continuar...\n");
  await new Promise((r) => setTimeout(r, 5000));

  // Processa em lotes
  let sent = 0;
  let failed = 0;
  const failedEmails: string[] = [];

  const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    process.stdout.write(
      `Lote ${batchNum}/${totalBatches} (${batch.length} e-mails)... `
    );

    const promises = batch.map(async (candidate) => {
      const firstName = candidate.full_name?.split(" ")[0]?.trim() ?? "";
      const { html, subject } = buildMigrationEmail(firstName, candidate.email);

      const { error } = await resend.emails.send({
        from: FROM,
        replyTo: REPLY_TO,
        to: candidate.email,
        subject,
        html,
      });

      if (error) {
        return { ok: false, email: candidate.email, error: error.message };
      }
      return { ok: true, email: candidate.email };
    });

    const results = await Promise.all(promises);

    const batchSent = results.filter((r) => r.ok).length;
    const batchFailed = results.filter((r) => !r.ok).length;
    sent += batchSent;
    failed += batchFailed;

    results
      .filter((r) => !r.ok)
      .forEach((r) => {
        failedEmails.push(r.email);
        console.warn(`\n   ⚠️  Falha: ${r.email} — ${(r as { error?: string }).error ?? "erro desconhecido"}`);
      });

    console.log(`✓ ${batchSent} enviados${batchFailed > 0 ? `, ${batchFailed} falhou` : ""}`);

    // Aguarda entre lotes (exceto no último)
    if (i + BATCH_SIZE < candidates.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // Relatório final
  console.log("\n─────────────────────────────────────");
  console.log(`✅ Enviados com sucesso: ${sent}`);
  if (failed > 0) {
    console.warn(`❌ Falhas:              ${failed}`);
    const failedFile = path.resolve(__dirname, "../failed-migration-emails.txt");
    fs.writeFileSync(failedFile, failedEmails.join("\n") + "\n", "utf-8");
    console.warn(`   Lista salva em: ${failedFile}`);
  }
  console.log("─────────────────────────────────────\n");

  if (failed > 0) process.exit(1);
})();
