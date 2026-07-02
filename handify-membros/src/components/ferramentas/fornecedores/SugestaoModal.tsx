'use client'

import { useState } from 'react'
import { X, Send, Lightbulb } from 'lucide-react'
import { useModalBackGuard } from '@/hooks/useModalBackGuard'
import { submitSuggestion } from '@/lib/fornecedores/actions'

interface Props {
  userId: string
  onClose: () => void
}

export function SugestaoModal({ userId, onClose }: Props) {
  useModalBackGuard(true, onClose)

  const [form, setForm] = useState({ name: '', url: '', what_they_sell: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function set(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    setError('')
    const result = await submitSuggestion(userId, form)
    setLoading(false)
    if (result.error) {
      setError('Não foi possível enviar a sugestão. Tente novamente.')
    } else {
      setDone(true)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header stripe */}
        <div className="brand-stripe"><span /><span /><span /></div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[#6699F3]/10">
                <Lightbulb className="w-4 h-4 text-[#6699F3]" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-foreground">Sugerir fornecedor</h2>
                <p className="text-xs text-muted-foreground">Conhece um fornecedor incrível?</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {done ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">🎉</div>
              <p className="font-semibold text-sm text-foreground mb-1">Sugestão enviada!</p>
              <p className="text-xs text-muted-foreground mb-4">
                Nossa equipe vai avaliar e adicionar à lista em breve.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[#6699F3] text-white text-sm font-medium rounded-lg hover:bg-[#5588e8] transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Nome do fornecedor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Ex: Aromas Brasil"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Link (site, Instagram, Shopee...)
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => set('url', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  O que eles vendem?
                </label>
                <input
                  type="text"
                  value={form.what_they_sell}
                  onChange={e => set('what_they_sell', e.target.value)}
                  placeholder="Ex: Essências, ceras, pavios..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Por que você recomenda?
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Preço bom, qualidade, entrega rápida..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3] resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !form.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#6699F3] text-white text-sm font-medium rounded-lg hover:bg-[#5588e8] disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {loading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
