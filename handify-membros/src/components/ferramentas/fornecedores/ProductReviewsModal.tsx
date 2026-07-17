'use client'

import { useState, useEffect } from 'react'
import { X, MessageCircle, Send, User } from 'lucide-react'
import { useModalBackGuard } from '@/hooks/useModalBackGuard'
import { getProductReviews, submitProductReview } from '@/lib/fornecedores/actions'
import type { ProductWithDetails, ProductReviewWithProfile } from '@/lib/fornecedores/types'

interface Props {
  product: ProductWithDetails
  userId: string
  onClose: () => void
}

export function ProductReviewsModal({ product, userId, onClose }: Props) {
  useModalBackGuard(true, onClose)

  const [reviews, setReviews] = useState<ProductReviewWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  useEffect(() => {
    getProductReviews(product.id).then(r => {
      setReviews(r)
      setLoading(false)
    })
  }, [product.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (body.trim().length < 10) return
    setSubmitting(true)
    const result = await submitProductReview(userId, product.id, body.trim())
    setSubmitting(false)
    if (result.error) {
      setSubmitMsg('Erro ao enviar. Tente novamente.')
    } else {
      setBody('')
      setSubmitMsg('Comentário enviado! Ele ficará visível após aprovação.')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="brand-stripe"><span /><span /><span /></div>

        {/* Header */}
        <div className="p-4 border-b border-border/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#6699F3]" />
            <div>
              <p className="font-semibold text-sm">{product.name}</p>
              <p className="text-xs text-muted-foreground">Comentários das alunas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reviews list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : reviews.length === 0 ? (
            <div className="text-center py-6">
              <MessageCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">Seja a primeira a avaliar este produto!</p>
            </div>
          ) : (
            reviews.map(r => (
              <div key={r.id} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  {r.profiles?.avatar_url ? (
                    <img src={r.profiles.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#6699F3]/20 flex items-center justify-center">
                      <User className="w-3 h-3 text-[#6699F3]" />
                    </div>
                  )}
                  <span className="text-xs font-medium">{r.profiles?.full_name ?? 'Aluna'}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {new Date(r.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{r.body}</p>
              </div>
            ))
          )}
        </div>

        {/* Submit form */}
        <div className="p-4 border-t border-border/60 shrink-0">
          {submitMsg ? (
            <p className="text-xs text-center text-muted-foreground py-2">{submitMsg}</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <textarea
                rows={2}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Compartilhe sua experiência com este produto (mínimo 10 caracteres)..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3] resize-none"
              />
              <button
                type="submit"
                disabled={submitting || body.trim().length < 10}
                className="self-end px-3 py-2 bg-[#6699F3] text-white rounded-lg hover:bg-[#5588e8] disabled:opacity-40 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Comentários são revisados antes de aparecerem publicamente.
          </p>
        </div>
      </div>
    </>
  )
}
