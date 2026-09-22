"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { markLessonComplete } from "@/app/(student)/aulas/actions";

/**
 * Botão "Próxima" da página de aula.
 *
 * Até aqui ele marcava a aula e ia embora no mesmo tique: o `markLessonComplete`
 * saía sem `await`, com um `.catch(() => {})` pendurado, e o `router.push`
 * desmontava a rota com a Server Action ainda em voo. Duas coisas quebravam para
 * a aluna:
 *
 * 1. quando a gravação falhava, ela não ficava sabendo. A action lança
 *    "Não foi possível salvar o progresso" e o `.catch` vazio engolia — a
 *    próxima aula abria normalmente e a barra de progresso ficava parada, sem
 *    nenhuma explicação;
 * 2. quando a gravação teria dado certo, a navegação podia abortar a requisição
 *    antes de o servidor responder. É a origem do "assisti e o progresso não
 *    anda" em quem avança pelo botão em vez de deixar o vídeo rodar — quem
 *    deixa já é salvo pelo autoMark do PandaPlayer, que trata o erro direito.
 *
 * E um terceiro: a action devolve `certificateIssued` e o botão jogava fora. Se
 * o clique fechasse o curso — cenário real de quem assiste fora de ordem e volta
 * para preencher uma aula do meio, já que "existe próxima aula" não quer dizer
 * "existe aula pendente" — a comemoração nunca aparecia, porque
 * `/perfil?certificado=1` é o único gatilho dela.
 */
interface NextLessonButtonProps {
  nextLessonId: string;
  lessonId: string;
  isCompleted: boolean;
}

export default function NextLessonButton({
  nextLessonId,
  lessonId,
  isCompleted,
}: NextLessonButtonProps) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function irParaProxima() {
    router.push(`/aulas/${nextLessonId}`);
  }

  function handleClick() {
    // Duplo clique dispararia duas actions e duas navegações.
    if (isPending) return;
    setError(false);

    // Já concluída: não regrava, só avança. Sem spinner para quem só navega.
    if (isCompleted) {
      irParaProxima();
      return;
    }

    startTransition(async () => {
      try {
        // O `await` é a correção: a navegação só acontece depois que o servidor
        // respondeu, senão a gravação morre junto com a rota que desmontou.
        const result = await markLessonComplete(lessonId);
        if (result.certificateIssued) {
          router.push("/perfil?certificado=1");
          return;
        }
        irParaProxima();
      } catch {
        // Não navega: o ponto da correção é a aluna perceber que o progresso
        // não salvou, em vez de descobrir semanas depois pela barra parada.
        setError(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        aria-busy={isPending}
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-[#6699F3] hover:bg-[#5580d4] active:bg-[#4a70c0] disabled:opacity-70 transition-colors px-3 py-2.5 min-h-[44px] rounded-lg"
      >
        Próxima
        {isPending ? (
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
      </button>

      {error && (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Não foi possível salvar o progresso. Tente novamente.
          </span>
          {/* Escape para não prender a aluna na aula se o servidor estiver fora. */}
          <button
            type="button"
            onClick={irParaProxima}
            className="text-xs text-muted-foreground underline self-center hover:text-foreground"
          >
            Ir sem marcar
          </button>
        </div>
      )}
    </div>
  );
}
