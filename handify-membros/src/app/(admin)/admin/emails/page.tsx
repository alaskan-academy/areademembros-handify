"use client";

import { useState, useTransition } from "react";
import { Send, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { sendTestEmail } from "./actions";

const EMAIL_TYPES = [
  { value: "welcome", label: "Boas-vindas", description: "Enviado ao criar conta" },
  { value: "access", label: "Acesso liberado", description: "Enviado após compra confirmada" },
  { value: "certificate", label: "Certificado disponível", description: "Enviado ao concluir curso" },
  { value: "reengagement", label: "Lembrete de reengajamento", description: "7 dias sem acessar o curso" },
  { value: "new_course", label: "Novo curso", description: "Quando um curso é publicado" },
  { value: "news_post", label: "Novidade no feed", description: "Quando um post é publicado" },
  { value: "refund", label: "Reembolso", description: "Enviado ao revogar matrícula (cancelamento/reembolso)" },
];

export default function EmailsAdminPage() {
  const [selected, setSelected] = useState("welcome");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    if (!to || !to.includes("@")) return;
    setResult(null);
    startTransition(async () => {
      const res = await sendTestEmail(selected, to);
      setResult(res);
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8 px-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="w-6 h-6 text-[#6699F3]" />
          E-mails automáticos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Envie um e-mail de teste para visualizar como aparece na caixa de entrada.
        </p>
      </div>

      {/* Tipos */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Tipo de e-mail</p>
        <div className="grid gap-2">
          {EMAIL_TYPES.map((type) => (
            <label
              key={type.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selected === type.value
                  ? "border-[#6699F3] bg-[#6699F3]/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={type.value}
                checked={selected === type.value}
                onChange={() => setSelected(type.value)}
                className="mt-0.5 accent-[#6699F3]"
              />
              <div>
                <p className="text-sm font-medium">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Destinatário */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="to">
          Enviar para (seu e-mail de teste)
        </label>
        <input
          id="to"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="seuemail@exemplo.com"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
        />
      </div>

      {/* Resultado */}
      {result && (
        <div
          className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
            result.success
              ? "bg-[#72CF92]/10 text-[#2a7a4a]"
              : "bg-red-50 text-red-700"
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          {result.success ?? result.error}
        </div>
      )}

      {/* Botão */}
      <button
        onClick={handleSend}
        disabled={isPending || !to}
        className="flex items-center gap-2 bg-[#6699F3] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#4d7de0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        {isPending ? "Enviando..." : "Enviar e-mail de teste"}
      </button>
    </div>
  );
}
