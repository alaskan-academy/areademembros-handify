"use client";

import { useTransition } from "react";
import { Trash2, Send, XCircle } from "lucide-react";
import { deleteCampaign, cancelCampaign, dispatchCampaign } from "@/lib/notifications/actions";

export function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir esta campanha? Esta ação não pode ser desfeita.")) return;
        startTransition(() => deleteCampaign(id));
      }}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
      aria-label="Excluir"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

export function CancelButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm("Cancelar o agendamento desta campanha?")) return;
        startTransition(() => cancelCampaign(id));
      }}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-[#FEC649] hover:bg-[#FEC649]/10 transition-colors disabled:opacity-40"
      aria-label="Cancelar agendamento"
    >
      <XCircle className="w-4 h-4" />
    </button>
  );
}

export function SendNowButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm("Enviar esta campanha agora para todas as alunas alvo?")) return;
        startTransition(() => dispatchCampaign(id));
      }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-60"
      style={{ background: "#72CF92" }}
      aria-label="Enviar agora"
    >
      <Send className="w-3 h-3" />
      {isPending ? "Enviando…" : "Enviar agora"}
    </button>
  );
}
