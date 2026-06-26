"use client";

import { useState, useTransition, useRef } from "react";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";
import { Plus, X, Send, Clock, Users, BookOpen } from "lucide-react";
import { createCampaign } from "@/lib/notifications/actions";

type Course = { id: string; title: string };

export default function NovaCampanhaForm({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  useModalBackGuard(open, () => setOpen(false));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [agendado, setAgendado] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createCampaign(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        formRef.current?.reset();
        setAgendado(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
        style={{ background: "#6699F3" }}
      >
        <Plus className="w-4 h-4" />
        Nova notificação
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={() => setOpen(false)}>
      <div className="handify-card w-full max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Nova notificação</h2>
          <button onClick={() => setOpen(false)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Título */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input name="title" required maxLength={120}
              placeholder="Ex: Novo curso disponível!"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40" />
          </div>

          {/* Mensagem */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Mensagem <span className="text-red-500">*</span>
            </label>
            <textarea name="body" required maxLength={500} rows={3}
              placeholder="Texto da notificação que a aluna verá…"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 resize-none" />
          </div>

          {/* Link opcional */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Link ao clicar (opcional)
            </label>
            <input name="link" type="url" placeholder="https://… ou /cursos/slug"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40" />
          </div>

          {/* Público-alvo */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Para quem enviar <span className="text-red-500">*</span>
            </label>
            <select name="target" defaultValue="all"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40">
              <option value="all">
                Todas as alunas
              </option>
              {courses.map((c) => (
                <option key={c.id} value={`course:${c.id}`}>
                  Matriculadas em: {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Agendamento */}
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setAgendado((v) => !v)}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${agendado ? "border-[#6699F3] text-[#6699F3] bg-[#6699F3]/10" : "border-border text-muted-foreground hover:border-[#6699F3] hover:text-[#6699F3]"}`}>
              <Clock className="w-3.5 h-3.5" />
              Agendar envio
            </button>
            {agendado && (
              <input name="scheduled_at" type="datetime-local" required={agendado}
                min={new Date().toISOString().slice(0, 16)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40" />
            )}
          </div>
          {!agendado && (
            <input type="hidden" name="scheduled_at" value="" />
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
              style={{ background: "#6699F3" }}>
              {agendado ? <Clock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {isPending ? "Enviando…" : agendado ? "Agendar" : "Enviar agora"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
