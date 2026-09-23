'use client'

import CommentBox from "@/components/ui/comment-box";
import { useState, useEffect, useRef, useTransition } from 'react'
import { Send, MessageCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getComments, submitComment } from '@/lib/inspiracoes/actions'
import type { InspiracaoComment } from '@/lib/inspiracoes/types'

interface Props {
  postId: string
  userId: string
  /**
   * Comentário que veio no link profundo (`/inspiracoes?post=…&comentario=…`).
   *
   * O painel rola até ele e o realça por alguns segundos. Sem isso a aluna que
   * clica em "alguém respondeu ao seu comentário" cai num post que pode ter
   * trinta comentários e não acha o dela.
   */
  destacarComentarioId?: string | null
}

/**
 * Realce temporário do comentário que veio no link.
 *
 * Leve de propósito: é para o olho achar no meio dos outros, não para gritar.
 * O `p-2 -m-2` dá respiro ao anel sem empurrar os comentários vizinhos.
 */
const REALCE = 'rounded-xl ring-2 ring-[#6699F3] bg-[#6699F3]/5 p-2 -m-2'

/** null = ainda não enviou. */
type EstadoDoEnvio = 'pendente' | 'publicado' | null

/**
 * O comentário de admin nasce aprovado — a Jessica não precisa mais aprovar a
 * própria resposta na fila de moderação. Quem decide isso é `submitComment`,
 * que devolve `approved`.
 *
 * Aqui é só a tela contar a verdade: dizer "aguarda aprovação da equipe" para
 * quem acabou de ver a própria resposta aparecer logo acima é o tipo de recado
 * que faz a pessoa ir procurar na fila o que já está publicado.
 *
 * O `in` em vez de `result.approved` direto é de propósito: a tela continua
 * funcionando (caindo em "pendente") se o campo sumir do retorno.
 */
function estadoDoEnvio(result: object): EstadoDoEnvio {
  return 'approved' in result && result.approved ? 'publicado' : 'pendente'
}

function Avatar({ name, size = 'md' }: { name: string | null; size?: 'sm' | 'md' }) {
  const cls = size === 'sm'
    ? 'w-6 h-6 text-xs bg-[#72CF92]/15 text-[#72CF92]'
    : 'w-7 h-7 text-xs bg-[#6699F3]/10 text-[#6699F3]'
  return (
    <div className={`${cls} rounded-full flex items-center justify-center shrink-0 font-bold uppercase`}>
      {(name ?? 'A').charAt(0)}
    </div>
  )
}

function ReplyForm({
  parentId,
  parentName,
  userId,
  postId,
  onRefresh,
  onClose,
}: {
  parentId: string
  parentName: string | null
  userId: string
  postId: string
  onRefresh: () => void
  onClose: () => void
}) {
  const [body, setBody] = useState('')
  const [sent, setSent] = useState<EstadoDoEnvio>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, startSubmit] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    setError(null)
    startSubmit(async () => {
      const result = await submitComment(userId, postId, trimmed, parentId)
      if (result.error) {
        setError(result.error)
      } else {
        setSent(estadoDoEnvio(result))
        onRefresh()
        setTimeout(onClose, 2500)
      }
    })
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-[#6699F3]/8 border border-[#6699F3]/20 px-3 py-2">
        <p className="text-xs text-[#6699F3] font-medium">
          {sent === 'publicado'
            ? 'Resposta publicada! Já está na conversa.'
            : 'Resposta enviada! Aguarda aprovação da equipe.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <CommentBox
          value={body}
          onChange={setBody}
          placeholder={`Responder a ${parentName ?? "Aluna"}...`}
          autoFocus
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 px-2.5 h-10 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!body.trim() || isSubmitting}
          aria-label="Enviar resposta"
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[#6699F3] text-white disabled:opacity-40 hover:bg-[#5588e8] transition-colors"
        >
          {isSubmitting
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Send className="w-3 h-3" />
          }
        </button>
      </form>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function CommentItem({
  c,
  replyingTo,
  setReplyingTo,
  userId,
  postId,
  onRefresh,
  destacado,
}: {
  c: InspiracaoComment
  replyingTo: string | null
  setReplyingTo: (id: string | null) => void
  userId: string
  postId: string
  onRefresh: () => void
  /** Id do comentário realçado agora (vindo do link profundo), ou null. */
  destacado: string | null
}) {
  const isReplying = replyingTo === c.id

  return (
    <div>
      <div
        data-comentario-id={c.id}
        className={cn('flex gap-2.5 handify-transition', destacado === c.id && REALCE)}
      >
        <Avatar name={c.profiles?.full_name ?? null} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-none mb-1">{c.profiles?.full_name ?? 'Aluna'}</p>
          <p className="text-xs text-foreground/75 leading-relaxed">{c.body}</p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </p>
            <button
              onClick={() => setReplyingTo(isReplying ? null : c.id)}
              className="text-xs text-[#6699F3] font-medium hover:underline"
            >
              Responder
            </button>
          </div>
        </div>
      </div>

      {/* Respostas aprovadas */}
      {(c.replies ?? []).length > 0 && (
        <div className="ml-9 mt-2.5 space-y-2.5 border-l-2 border-[#6699F3]/15 pl-3">
          {(c.replies ?? []).map(r => (
            <div
              key={r.id}
              data-comentario-id={r.id}
              className={cn('flex gap-2 handify-transition', destacado === r.id && REALCE)}
            >
              <Avatar name={r.profiles?.full_name ?? null} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-none mb-1">{r.profiles?.full_name ?? 'Aluna'}</p>
                <p className="text-xs text-foreground/75 leading-relaxed">{r.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(r.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulário de resposta */}
      {isReplying && (
        <div className="ml-9 mt-2.5">
          <ReplyForm
            parentId={c.id}
            parentName={c.profiles?.full_name ?? null}
            userId={userId}
            postId={postId}
            onRefresh={onRefresh}
            onClose={() => setReplyingTo(null)}
          />
        </div>
      )}
    </div>
  )
}

export function ComentariosPanel({ postId, userId, destacarComentarioId = null }: Props) {
  const [comments, setComments] = useState<InspiracaoComment[]>([])
  const [isLoading, startLoad] = useTransition()
  const [carregou, setCarregou] = useState(false)
  const [body, setBody] = useState('')
  const [sent, setSent] = useState<EstadoDoEnvio>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, startSubmit] = useTransition()
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [destacado, setDestacado] = useState<string | null>(null)

  const listaRef = useRef<HTMLDivElement>(null)
  const cabecalhoRef = useRef<HTMLHeadingElement>(null)
  // Rolar uma vez só: se ela rolar para ler outra coisa, a tela não pode
  // puxá-la de volta a cada re-render do painel.
  const jaRolou = useRef(false)

  function load() {
    startLoad(async () => {
      const c = await getComments(postId)
      setComments(c)
      setCarregou(true)
    })
  }

  useEffect(() => { load() }, [postId])

  /**
   * Leva a aluna até o comentário que o link pedia.
   *
   * Espera `carregou` porque a lista chega vazia no primeiro render: procurar
   * antes disso não acharia nada e queimaria a única tentativa.
   *
   * A busca é escopada no `listaRef` de propósito. O feed monta um
   * ComentariosPanel por post aberto, e um `document.querySelector` acharia o
   * comentário de outro painel na mesma página.
   */
  useEffect(() => {
    if (!destacarComentarioId || jaRolou.current || !carregou) return
    jaRolou.current = true

    const frame = requestAnimationFrame(() => {
      const suave = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? ('auto' as const)
        : ('smooth' as const)

      const alvo = Array.from(
        listaRef.current?.querySelectorAll<HTMLElement>('[data-comentario-id]') ?? []
      ).find(el => el.dataset.comentarioId === destacarComentarioId)

      if (alvo) {
        alvo.scrollIntoView({ block: 'center', behavior: suave })
        setDestacado(destacarComentarioId)
        return
      }

      // Não achou: o comentário pode ter sido apagado pela moderação ou ainda
      // não estar aprovado (getComments só devolve aprovados). Em vez de largar
      // a aluna no topo do post sem entender o que a notificação queria
      // mostrar, pelo menos abre a conversa na altura dos comentários.
      cabecalhoRef.current?.scrollIntoView({ block: 'start', behavior: suave })
    })

    return () => {
      cancelAnimationFrame(frame)
      // Devolve a marca junto com o frame cancelado. Em dev o StrictMode monta,
      // desmonta e monta de novo: sem isto a primeira montagem gastaria a única
      // tentativa, o frame dela seria cancelado, e a rolagem nunca aconteceria.
      jaRolou.current = false
    }
  }, [destacarComentarioId, carregou])

  // O realce é para achar, não para ficar. Some sozinho.
  useEffect(() => {
    if (!destacado) return
    const t = setTimeout(() => setDestacado(null), 4000)
    return () => clearTimeout(t)
  }, [destacado])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    setError(null)
    startSubmit(async () => {
      const result = await submitComment(userId, postId, trimmed)
      if (result.error) {
        setError(result.error)
      } else {
        setBody('')
        setSent(estadoDoEnvio(result))
        load()
      }
    })
  }

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0)

  return (
    <div>
      <h3 ref={cabecalhoRef} className="text-sm font-semibold mb-4 flex items-center gap-2 scroll-mt-4">
        <MessageCircle className="w-4 h-4 text-[#6699F3]" />
        Comentários
        {!isLoading && totalCount > 0 && (
          <span className="text-xs font-normal text-muted-foreground">({totalCount})</span>
        )}
      </h3>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 text-[#6699F3] animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-4">Seja a primeira a comentar!</p>
      ) : (
        <div ref={listaRef} className="space-y-4 mb-4">
          {comments.map(c => (
            <CommentItem
              key={c.id}
              c={c}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              userId={userId}
              postId={postId}
              onRefresh={load}
              destacado={destacado}
            />
          ))}
        </div>
      )}

      {sent && (
        <div className="rounded-xl bg-[#6699F3]/8 border border-[#6699F3]/20 px-3 py-2.5 mb-3">
          <p className="text-xs text-[#6699F3] font-medium">
            {sent === 'publicado'
              ? 'Comentário publicado! Já está na conversa.'
              : 'Comentário enviado! Aguarda aprovação da equipe.'}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <CommentBox
          value={body}
          onChange={(v) => { setBody(v); setSent(null); }}
          placeholder="Escreva um comentário..."
        />
        <button
          type="submit"
          disabled={!body.trim() || isSubmitting}
          aria-label="Enviar comentário"
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-[#6699F3] text-white disabled:opacity-40 hover:bg-[#5588e8] transition-colors"
        >
          {isSubmitting
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Send className="w-3.5 h-3.5" />
          }
        </button>
      </form>
    </div>
  )
}
