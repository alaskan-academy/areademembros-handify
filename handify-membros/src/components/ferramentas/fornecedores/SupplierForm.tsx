'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { adminUpsertSupplier, adminDeleteSupplier } from '@/lib/fornecedores/actions'
import { PRODUCT_TAGS, CATEGORY_TAGS, CHANNEL_LABELS } from '@/lib/fornecedores/types'

type Channel = { channel: string; url: string }

interface Props {
  supplier?: any
}

export function SupplierForm({ supplier }: Props) {
  const router = useRouter()
  const isEdit = !!supplier

  const [name, setName] = useState(supplier?.name ?? '')
  const [description, setDescription] = useState(supplier?.description ?? '')
  const [logoUrl, setLogoUrl] = useState(supplier?.logo_url ?? '')
  const [verified, setVerified] = useState(supplier?.verified ?? false)
  const [active, setActive] = useState(supplier?.active ?? true)
  const [position, setPosition] = useState(supplier?.position ?? 0)

  const existingChannels: Channel[] = (supplier?.supplier_channels ?? []).map((c: any) => ({
    channel: c.channel,
    url: c.url,
  }))
  const [channels, setChannels] = useState<Channel[]>(
    existingChannels.length > 0 ? existingChannels : [{ channel: 'website', url: '' }]
  )

  const existingTags: string[] = (supplier?.supplier_tags ?? []).map((t: any) => t.tag)
  const [tags, setTags] = useState<Set<string>>(new Set(existingTags))

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
        position: Number(position),
        channels: channels.filter(c => c.url),
        tags: [...tags],
      })
      router.push('/admin/fornecedores')
    } catch (err: any) {
      setError(err.message ?? 'Erro ao salvar')
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!supplier?.id) return
    if (!confirm(`Excluir "${supplier.name}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    await adminDeleteSupplier(supplier.id)
    router.push('/admin/fornecedores')
  }

  const allTags = { ...PRODUCT_TAGS, ...CATEGORY_TAGS }

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

        {/* Position */}
        <Field label="Posição (ordem)">
          <input type="number" min={0} value={position} onChange={e => setPosition(e.target.value)}
            className={`${INPUT_CLS} w-32`} />
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
              className={`${INPUT_CLS} w-40 shrink-0`}>
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

      {/* Tags */}
      <div className="bg-white rounded-xl border border-border/60 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Tags</h2>
        <p className="text-xs text-muted-foreground">Selecione os produtos e categorias que este fornecedor atende.</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(allTags).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => toggleTag(k)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                tags.has(k)
                  ? 'bg-[#6699F3] text-white border-[#6699F3]'
                  : 'bg-white text-muted-foreground border-border/60 hover:border-[#6699F3]/60'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

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
