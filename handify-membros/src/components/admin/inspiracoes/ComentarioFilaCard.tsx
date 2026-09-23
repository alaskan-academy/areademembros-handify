import Link from 'next/link'
import { Check, CornerDownRight, ExternalLink, Trash2 } from 'lucide-react'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'

/**
 * Card da fila de moderação de comentários das Inspirações.
 *
 * O card inteiro de texto é um link para o post no acervo. Antes a tela mostrava
 * só o comentário solto — a Jessica aprovava "ficou lindo, qual essência?" sem
 * saber onde tinha sido escrito, e não tinha por onde responder. Agora ela clica
 * no comentário, cai no post com ele em destaque e responde por lá.
 *
 * Abre em aba nova de propósito: aprovar é trabalho de fila, e voltar do acervo
 * para a lista perderia a rolagem e a posição dela.
 */
export interface ComentarioDaFila {
  id: string
  postTitulo: string
  autorNome: string | null
  body: string
  createdAt: string
  aprovado: boolean
  paiNome: string | null
  paiTexto: string | null
  /** Link profundo do acervo (`/inspiracoes?post=…&comentario=…`). */
  href: string
}

export default function ComentarioFilaCard({
  comentario,
  aprovar,
  excluir,
}: {
  comentario: ComentarioDaFila
  /** Server Action já com o id no bind. Ausente na lista de aprovados. */
  aprovar?: () => Promise<void>
  excluir: () => Promise<void>
}) {
  const {
    postTitulo,
    autorNome,
    body,
    createdAt,
    aprovado,
    paiNome,
    paiTexto,
    href,
  } = comentario

  const data = new Date(createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })

  return (
    <article className="bg-white rounded-xl border border-border/60 p-4 handify-transition hover:border-[#6699F3]/40">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-[#2D2D2D]">
          {autorNome ?? 'Aluna'}
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            aprovado
              ? 'bg-[#72CF92]/15 text-[#3f8a5c]'
              : 'bg-[#6699F3]/12 text-[#3d6fc4]'
          }`}
        >
          {aprovado ? 'Publicado' : 'Na fila'}
        </span>
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {data}
        </span>
      </div>

      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block -mx-2 mt-2 px-2 py-2 rounded-lg handify-transition hover:bg-[#6699F3]/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6699F3]"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-[#6699F3]">
          <span className="truncate">{postTitulo}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-70" aria-hidden="true" />
        </span>

        {paiTexto && (
          <span className="flex gap-1.5 mt-2 border-l-2 border-[#72CF92]/50 pl-2.5 text-xs text-muted-foreground">
            <CornerDownRight className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
            <span className="block">
              <span className="font-medium">
                Em resposta a {paiNome ?? 'Aluna'}:
              </span>{' '}
              {paiTexto}
            </span>
          </span>
        )}

        <span className="block mt-2 text-xs leading-relaxed text-[#2D2D2D] whitespace-pre-wrap break-words">
          {body}
        </span>

        <span className="block mt-2 text-xs text-muted-foreground group-hover:text-[#6699F3] handify-transition">
          Ver no post {aprovado ? 'e responder' : ''} &rarr;
        </span>
      </Link>

      <div className="flex gap-2 mt-3">
        {aprovar && (
          <form action={aprovar} className="flex-1">
            <button
              type="submit"
              className="w-full min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#72CF92]/15 text-[#3f8a5c] rounded-lg handify-transition hover:bg-[#72CF92]/25"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              Aprovar
            </button>
          </form>
        )}
        <form action={excluir} className={aprovar ? 'shrink-0' : 'flex-1'}>
          <ConfirmSubmitButton
            pergunta="Excluir este comentário? A aluna perde o que escreveu e não dá para desfazer."
            title="Excluir"
            className="w-full min-h-[44px] px-4 flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg handify-transition hover:bg-red-100"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            {/* Na fila o botão fica só com o ícone, para "Aprovar" ficar largo. */}
            {aprovar ? null : 'Excluir'}
            <span className="sr-only">Excluir comentário</span>
          </ConfirmSubmitButton>
        </form>
      </div>
    </article>
  )
}
