'use client'

import CommentBox from "@/components/ui/comment-box";
import { useState, useEffect, useTransition } from 'react'
import { Send, MessageCircle, Loader2 } from 'lucide-react'
import { getComments, submitComment } from '@/lib/inspiracoes/actions'
import type { InspiracaoComment } from '@/lib/inspiracoes/types'

interface Props {
  postId: string
  userId: string
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
  const [sent, setSent] = useState(false)
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
        setSent(true)
        onRefresh()
        setTimeout(onClose, 2500)
      }
    })
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-[#6699F3]/8 border border-[#6699F3]/20 px-3 py-2">
        <p className="text-xs text-[#6699F3] font-medium">Resposta enviada! Aguarda aprovação da equipe.</p>
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
}: {
  c: InspiracaoComment
  replyingTo: string | null
  setReplyingTo: (id: string | null) => void
  userId: string
  postId: string
  onRefresh: () => void
}) {
  const isReplying = replyingTo === c.id

  return (
    <div>
      <div className="flex gap-2.5">
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
            <div key={r.id} className="flex gap-2">
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

export function ComentariosPanel({ postId, userId }: Props) {
  const [comments, setComments] = useState<InspiracaoComment[]>([])
  const [isLoading, startLoad] = useTransition()
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, startSubmit] = useTransition()
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  function load() {
    startLoad(async () => {
      const c = await getComments(postId)
      setComments(c)
    })
  }

  useEffect(() => { load() }, [postId])

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
        setSent(true)
        load()
      }
    })
  }

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0)

  return (
    <div>
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
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
        <div className="space-y-4 mb-4">
          {comments.map(c => (
            <CommentItem
              key={c.id}
              c={c}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              userId={userId}
              postId={postId}
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {sent && (
        <div className="rounded-xl bg-[#6699F3]/8 border border-[#6699F3]/20 px-3 py-2.5 mb-3">
          <p className="text-xs text-[#6699F3] font-medium">
            Comentário enviado! Aguarda aprovação da equipe.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <CommentBox
          value={body}
          onChange={(v) => { setBody(v); setSent(false); }}
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
