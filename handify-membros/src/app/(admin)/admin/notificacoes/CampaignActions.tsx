"use client";

import { useTransition } from "react";
import { Trash2, Send, XCircle, Unlock } from "lucide-react";
import {
  deleteCampaign,
  cancelCampaign,
  dispatchCampaign,
  destravarCampanha,
} from "@/lib/notifications/actions";

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

/**
 * "Destravar" — o único botão que o status "Enviando" oferece.
 *
 * Campanha cujo disparo morre no timeout da função da Vercel fica presa em
 * "Enviando": o cron procura só as agendadas e, até aqui, o painel não tinha
 * ação nenhuma para essa linha. Ela ficava na tela para sempre, marcada com 0
 * enviadas mesmo tendo alcançado milhares de alunas.
 *
 * Destravar NÃO reenvia, e a pergunta abaixo diz isso com todas as letras: a
 * campanha que caiu no meio já entregou parte das notificações e a tabela não
 * tem dedupe, então um reenvio chegaria em duplicata para quem já recebeu.
 * Aqui a gente só conta o que saiu e corrige o status.
 *
 * Segue o padrão de confirmação do ConfirmSubmitButton (dizer o que vai
 * acontecer, não perguntar "tem certeza?"), no formato de useTransition que os
 * outros botões desta página já usam.
 */
export function DestravarButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (
          !window.confirm(
            "Destravar esta campanha?\n\n" +
              "Vou contar quantas alunas já receberam antes da queda e marcar a campanha " +
              "como Parcial com esse número (ou como Rascunho, se ninguém recebeu).\n\n" +
              "NADA é reenviado: nenhuma notificação nova, nenhum push. Quem já recebeu " +
              "não recebe de novo.\n\n" +
              "Use só quando a campanha estiver parada há vários minutos."
          )
        )
          return;
        startTransition(async () => {
          const r = await destravarCampanha(id);
          // O retorno importa: se a contagem falhar, a ação não mexe em nada, e
          // um botão mudo faria a admin achar que destravou.
          if (r?.error) window.alert(r.error);
        });
      }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-60"
      style={{ background: "#6699F3" }}
      title="Tirar a campanha de “Enviando” sem reenviar nada"
      aria-label="Destravar campanha"
    >
      <Unlock className="w-3 h-3" />
      {isPending ? "Destravando…" : "Destravar"}
    </button>
  );
}
