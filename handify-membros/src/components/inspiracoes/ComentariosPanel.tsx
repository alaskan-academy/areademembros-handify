'use client'

import { useState, useEffect, useTransition } from 'react'
import { Send, MessageCircle, Loader2 } from 'lucide-react'
import { getComments, submitComment } from '@/lib/inspiracoes/actions'
import type { InspiracaoComment } from '@/lib/inspiracoes/types'

interface Props {
  postId: string
  userId: string
}

export function ComentariosPanel({ postId, userId }: Props) {
  const [comments, setComments] = useState<InspiracaoComment[]>([])
  const [isLoading, startLoad] = useTransition()
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, startSubmit] = useTransition()

  useEffect(() => {
    startLoad(async () => {
      const c = await getComments(postId)
      setComments(c)
    })
  }, [postId])

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
        const c = await getComments(postId)
        setComments(c)
      }
    })
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-[#6699F3]" />
        Comentários
        {!isLoading && comments.length > 0 && (
          <span className="text-xs font-normal text-muted-foreground">({comments.length})</span>
        )}
      </h3>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 text-[#6699F3] animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-4">Seja a primeira a comentar!</p>
      ) : (
        <div className="space-y-3 mb-4">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#6699F3]/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-[#6699F3] uppercase">
                {(c.profiles?.full_name ?? 'A').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-none mb-1">{c.profiles?.full_name ?? 'Aluna'}</p>
                <p className="text-xs text-foreground/75 leading-relaxed">{c.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(c.created_at).toLocaleDateString('pt-BR', { timeZone: "America/Sao_Paulo" })}
                </p>
              </div>
            </div>
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
        <input
          value={body}
          onChange={e => { setBody(e.target.value); setSent(false) }}
          placeholder="Escreva um comentário..."
          maxLength={2000}
          className="flex-1 text-xs px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 transition-shadow min-h-[44px]"
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
