/**
 * Recria token de ativação e reenvia e-mail para um endereço.
 * Uso: node scripts/resend-activation.mjs <email> <course_id>
 *
 * Requer .env.local com SUPABASE_SERVICE_ROLE_KEY e RESEND_API_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Lê .env.local manualmente
const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const email = process.argv[2];
if (!email) {
  console.error("Uso: node scripts/resend-activation.mjs <email> [course_id]");
  process.exit(1);
}
const courseIdArg = process.argv[3] ?? null;

// Busca curso associado ao e-mail (último token ou primeiro curso com product_code)
let courseId = courseIdArg;
if (!courseId) {
  const { data: lastToken } = await supabase
    .from("activation_tokens")
    .select("course_id")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  courseId = lastToken?.course_id ?? null;
}

if (!courseId) {
  console.error("Nenhum course_id encontrado. Passe como segundo argumento.");
  process.exit(1);
}

// Busca dados do curso
const { data: course } = await supabase
  .from("courses")
  .select("id, title, slug")
  .eq("id", courseId)
  .single();

if (!course) {
  console.error("Curso não encontrado:", courseId);
  process.exit(1);
}

// Busca buyer_name do último token
const { data: prevToken } = await supabase
  .from("activation_tokens")
  .select("buyer_name, buyer_phone")
  .eq("email", email)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

// Cria novo token
const { data: tokenRow, error: tokenErr } = await supabase
  .from("activation_tokens")
  .insert({
    email,
    course_id: courseId,
    buyer_name: prevToken?.buyer_name ?? null,
    buyer_phone: prevToken?.buyer_phone ?? null,
  })
  .select("token")
  .single();

if (tokenErr || !tokenRow?.token) {
  console.error("Erro ao criar token:", tokenErr?.message);
  process.exit(1);
}

const activationUrl = `${env.NEXT_PUBLIC_APP_URL}/ativar/${tokenRow.token}`;
console.log("\n✅ Token criado:", tokenRow.token);
console.log("🔗 Link de ativação:", activationUrl);

// Envia e-mail via Resend
const body = {
  from: "Handify <noreply@mail.handify.com.br>",
  to: [email],
  subject: `Seu acesso ao ${course.title} está liberado!`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:40px 32px">
      <p style="color:#6699F3;font-size:22px;font-weight:900;margin:0 0 8px">Handify™</p>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">Seu acesso está liberado! 🎉</h1>
      <p style="color:#555;font-size:15px;margin:0 0 24px">
        Olá! Clique no botão abaixo para criar sua conta e acessar o <strong>${course.title}</strong>.
      </p>
      <a href="${activationUrl}" style="display:inline-block;background:#6699F3;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px">
        Criar minha conta e acessar
      </a>
      <p style="color:#999;font-size:12px;margin:32px 0 0">
        Se o botão não funcionar, copie e cole este link no navegador:<br>
        <a href="${activationUrl}" style="color:#6699F3">${activationUrl}</a>
      </p>
    </div>
  `,
};

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
  body: JSON.stringify(body),
});

const result = await res.json();
if (res.ok) {
  console.log("📧 E-mail enviado para", email, "— ID:", result.id);
} else {
  console.error("❌ Erro ao enviar e-mail:", result);
}
