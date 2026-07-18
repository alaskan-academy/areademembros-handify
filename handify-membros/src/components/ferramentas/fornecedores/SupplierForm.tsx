'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Package, Pencil, Settings2, Check, Loader2, Trash2 } from 'lucide-react'
import {
  adminUpsertSupplier, adminDeleteSupplier,
  adminCreateTagType, adminUpdateTagType, adminDeleteTagType,
} from '@/lib/fornecedores/actions'
import { CHANNEL_LABELS } from '@/lib/fornecedores/types'
import type { SupplierTagType, NicheRow } from '@/lib/fornecedores/types'

type Channel = { channel: string; url: string }

interface LinkedProduct {
  id: string
  name: string
  image_url: string | null
  active: boolean
}

interface Props {
  supplier?: any
  tagTypes?: SupplierTagType[]
  niches?: NicheRow[]
  linkedProducts?: LinkedProduct[]
}

export function SupplierForm({ supplier, tagTypes: initialTagTypes = [], niches = [], linkedProducts = [] }: Props) {
  const router = useRouter()
  const isEdit = !!supplier

  const [name, setName] = useState(supplier?.name ?? '')
  const [description, setDescription] = useState(supplier?.description ?? '')
  const [logoUrl, setLogoUrl] = useState(supplier?.logo_url ?? '')
  const [verified, setVerified] = useState(supplier?.verified ?? false)
  const [active, setActive] = useState(supplier?.active ?? true)


  const existingChannels: Channel[] = (supplier?.supplier_channels ?? []).map((c: any) => ({
    channel: c.channel,
    url: c.url,
  }))
  const [channels, setChannels] = useState<Channel[]>(
    existingChannels.length > 0 ? existingChannels : [{ channel: 'website', url: '' }]
  )

  const existingTags: string[] = (supplier?.supplier_tags ?? []).map((t: any) => t.tag)
  const [tags, setTags] = useState<Set<string>>(new Set(existingTags))

  const existingNicheIds: string[] = (supplier?.supplier_niche_links ?? []).map((n: any) => n.niche_id)
  const [selectedNiches, setSelectedNiches] = useState<Set<string>>(new Set(existingNicheIds))

  const [tagTypes, setTagTypes] = useState<SupplierTagType[]>(initialTagTypes)
  const [showTagManager, setShowTagManager] = useState(false)
  const [newTagLabel, setNewTagLabel] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagLabel, setEditingTagLabel] = useState('')
  const [tagPending, startTagTransition] = useTransition()
  const [tagError, setTagError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  function addChannel() {
    setChannels(c => [...c, { channel: 'website', url: '' }])
  }
  function removeChannel(i: number) {
    setChannels(c => c.filter((_, idx) => idx !== i))
  }
  function updateChannel(i: number, key: keyof Channel, value: string) {
    setChannels(c => c.map((ch, idx) => idx === i ? { ...ch, [key]: value } : ch))
  }
  function toggleTag(tag: string) {
    setTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  function toggleNiche(id: string) {
    setSelectedNiches(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await adminUpsertSupplier({
        id: supplier?.id,
        name: name.trim(),
        description: description.trim(),
        logo_url: logoUrl.trim(),
        verified,
        active,
        channels: channels.filter(c => c.url),
        tags: [...tags],
        niche_ids: [...selectedNiches],
      })
      router.push('/admin/fornecedores')
    } catch (err: any) {
      setError(err.message ?? 'Erro ao salvar')
    }
    setLoading(false)
  }

  function handleCreateTag() {
    if (!newTagLabel.trim()) return
    startTagTransition(async () => {
      const result = await adminCreateTagType(newTagLabel)
      if (result.error) { setTagError(result.error); return }
      setTagTypes(prev => [...prev, { id: result.id!, slug: result.slug!, label: result.label!, position: prev.length + 1 }])
      setNewTagLabel('')
      setTagError(null)
    })
  }

  function handleUpdateTag(id: string) {
    if (!editingTagLabel.trim()) return
    startTagTransition(async () => {
      const result = await adminUpdateTagType(id, editingTagLabel)
      if (result.error) { setTagError(result.error); return }
      setTagTypes(prev => prev.map(t => t.id === id ? { ...t, label: editingTagLabel.trim() } : t))
      setEditingTagId(null)
      setTagError(null)
    })
  }

  function handleDeleteTag(id: string, label: string) {
    if (!confirm(`Excluir a tag "${label}"?`)) return
    startTagTransition(async () => {
      const result = await adminDeleteTagType(id)
      if (result.error) { setTagError(result.error); return }
      setTagTypes(prev => prev.filter(t => t.id !== id))
      setTagError(null)
    })
  }

  async function handleDelete() {
    if (!supplier?.id) return
    if (!confirm(`Excluir "${supplier.name}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    await adminDeleteSupplier(supplier.id)
    router.push('/admin/fornecedores')
  }

  const allTags = tagTypes

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/fornecedores" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold">{isEdit ? 'Editar fornecedor' : 'Novo fornecedor'}</h1>
        </div>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs px-3 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border/60 p-5 space-y-4">
        {/* Name */}
        <Field label="Nome do fornecedor *">
          <input required value={name} onChange={e => setName(e.target.value)}
            className={INPUT_CLS} placeholder="Ex: Aromas Brasil" />
        </Field>

        {/* Description */}
        <Field label="Descrição">
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={4} className={`${INPUT_CLS} resize-none`} placeholder="O que este fornecedor oferece..." />
        </Field>

        {/* Logo URL */}
        <Field label="URL do logo">
          <input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
            className={INPUT_CLS} placeholder="https://..." />
        </Field>

        {/* Toggles */}
        <div className="flex gap-6">
          <Toggle label="Verificado Handify" value={verified} onChange={setVerified} />
          <Toggle label="Ativo" value={active} onChange={setActive} />
        </div>
      </div>

      {/* Channels */}
      <div className="bg-white rounded-xl border border-border/60 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Canais de compra</h2>
        {channels.map((ch, i) => (
          <div key={i} className="flex gap-2">
            <select value={ch.channel} onChange={e => updateChannel(i, 'channel', e.target.value)}
              className="w-40 shrink-0 px-3 py-2 text-sm rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]">
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input type="url" value={ch.url} onChange={e => updateChannel(i, 'url', e.target.value)}
              className={`${INPUT_CLS} flex-1`} placeholder="https://..." />
            <button type="button" onClick={() => removeChannel(i)}
              className="p-2 text-muted-foreground hover:text-red-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={addChannel}
          className="flex items-center gap-1.5 text-xs text-[#6699F3] hover:underline">
          <Plus className="w-3.5 h-3.5" />
          Adicionar canal
        </button>
      </div>

      {/* Nichos */}
      {niches.length > 0 && (
        <div className="bg-white rounded-xl border border-border/60 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Nichos de artesanato</h2>
          <p className="text-xs text-muted-foreground">Selecione todos os nichos em que este fornecedor atua.</p>
          <div className="flex flex-wrap gap-2">
            {niches.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => toggleNiche(n.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  selectedNiches.has(n.id)
                    ? 'bg-[#72CF92] text-white border-[#72CF92]'
                    : 'bg-white text-muted-foreground border-border/60 hover:border-[#72CF92]/60'
                }`}
              >
                {n.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="bg-white rounded-xl border border-border/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tags</h2>
          <button
            type="button"
            onClick={() => setShowTagManager(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="w-3 h-3" />
            Gerenciar tags
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Selecione os tipos de insumos que este fornecedor vende.</p>

        <div className="flex flex-wrap gap-2">
          {allTags.map(t => (
            <button
              key={t.slug}
              type="button"
              onClick={() => toggleTag(t.slug)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                tags.has(t.slug)
                  ? 'bg-[#6699F3] text-white border-[#6699F3]'
                  : 'bg-white text-muted-foreground border-border/60 hover:border-[#6699F3]/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {showTagManager && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2 mt-1">
            {tagError && <p className="text-xs text-red-600">{tagError}</p>}
            <div className="space-y-1">
              {tagTypes.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  {editingTagId === t.id ? (
                    <>
                      <input
                        type="text"
                        value={editingTagLabel}
                        onChange={e => setEditingTagLabel(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); handleUpdateTag(t.id) }
                          if (e.key === 'Escape') setEditingTagId(null)
                        }}
                        autoFocus
                        className="flex-1 text-sm border border-[#6699F3] rounded-lg px-2.5 py-1 focus:outline-none bg-background"
                      />
                      <button type="button" onClick={() => handleUpdateTag(t.id)} disabled={tagPending}
                        className="p-1.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingTagId(null)}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm px-2.5 py-1 rounded-lg bg-background border border-border truncate">{t.label}</span>
                      <button type="button" onClick={() => { setEditingTagId(t.id); setEditingTagLabel(t.label) }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button type="button" onClick={() => handleDeleteTag(t.id, t.label)} disabled={tagPending}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1 border-t border-border/50">
              <input
                type="text"
                value={newTagLabel}
                onChange={e => setNewTagLabel(e.target.value)}
                placeholder="Nova tag..."
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
                className="flex-1 text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
              />
              <button type="button" onClick={handleCreateTag} disabled={tagPending || !newTagLabel.trim()}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50 shrink-0">
                {tagPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Criar
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Produtos vinculados — só na edição */}
      {supplier && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-[#6699F3]" />
              Produtos vinculados ({linkedProducts.length})
            </h2>
            <Link
              href="/admin/fornecedores/produtos/novo"
              className="text-xs px-2.5 py-1.5 border border-[#6699F3]/40 text-[#6699F3] rounded-lg hover:bg-[#6699F3]/5 transition-colors"
            >
              + Novo produto
            </Link>
          </div>

          {linkedProducts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Nenhum produto vinculado a este fornecedor ainda.
            </p>
          ) : (
            <div className="space-y-1.5">
              {linkedProducts.map(p => (
                <Link
                  key={p.id}
                  href={`/admin/fornecedores/produtos/${p.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-white hover:border-[#6699F3]/40 hover:bg-[#6699F3]/3 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg border border-border/40 bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    {!p.active && <span className="text-[10px] text-muted-foreground">Inativo</span>}
                  </div>
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-[#6699F3] transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/admin/fornecedores"
          className="flex-1 text-center py-2.5 text-sm font-medium border border-border/60 rounded-lg hover:bg-muted transition-colors">
          Cancelar
        </Link>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 text-sm font-medium bg-[#6699F3] text-white rounded-lg hover:bg-[#5588e8] disabled:opacity-50 transition-colors">
          {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar fornecedor'}
        </button>
      </div>
    </form>
  )
}

const INPUT_CLS = "w-full px-3 py-2 text-sm rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={() => onChange(!value)}
        className={`w-10 h-6 rounded-full transition-colors relative ${value ? 'bg-[#6699F3]' : 'bg-muted-foreground/30'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-[left] ${value ? 'left-5' : 'left-1'}`} />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </label>
  )
}
