'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Package } from 'lucide-react'
import { adminUpsertProduct } from '@/lib/fornecedores/actions'
import type { ProductWithDetails, NicheRow, SupplierRow } from '@/lib/fornecedores/types'

interface SupplierLink {
  supplier_id: string
  buy_url: string
  position: number
}

interface CourseOption {
  id: string
  title: string
  slug: string
}

interface Props {
  product?: ProductWithDetails
  niches: NicheRow[]
  suppliers: SupplierRow[]
  courses: CourseOption[]
}

export function ProdutoForm({ product, niches, suppliers, courses }: Props) {
  const router = useRouter()

  const [name, setName] = useState(product?.name ?? '')
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '')
  const [active, setActive] = useState(product?.active ?? true)
  const [position, setPosition] = useState(product?.position ?? 0)
  const [selectedNiches, setSelectedNiches] = useState<string[]>(
    product?.niches.map(n => n.id) ?? []
  )
  const [selectedCourses, setSelectedCourses] = useState<string[]>(
    product?.course_ids ?? []
  )
  const [supplierLinks, setSupplierLinks] = useState<SupplierLink[]>(
    product?.suppliers.map(l => ({
      supplier_id: l.supplier_id,
      buy_url: l.buy_url,
      position: l.position,
    })) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleNiche(id: string) {
    setSelectedNiches(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    )
  }

  function toggleCourse(id: string) {
    setSelectedCourses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  function addSupplierLink() {
    setSupplierLinks(prev => [
      ...prev,
      { supplier_id: '', buy_url: '', position: prev.length },
    ])
  }

  function updateSupplierLink(index: number, field: keyof SupplierLink, value: string | number) {
    setSupplierLinks(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  function removeSupplierLink(index: number) {
    setSupplierLinks(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      await adminUpsertProduct({
        id: product?.id,
        name: name.trim(),
        image_url: imageUrl.trim(),
        active,
        position,
        niche_ids: selectedNiches,
        course_ids: selectedCourses,
        supplier_links: supplierLinks
          .filter(l => l.supplier_id && l.buy_url)
          .map((l, i) => ({ ...l, position: i })),
      })
      router.push('/admin/fornecedores/produtos')
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Nome */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Nome do produto *</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Cera de carnaúba 1kg"
          className="w-full px-4 py-3 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]/50 transition-colors"
          required
        />
      </div>

      {/* Foto */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">URL da foto</label>
        <input
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-4 py-3 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]/50 transition-colors"
        />
        {imageUrl && (
          <div className="w-24 h-24 rounded-xl border border-border/60 overflow-hidden bg-muted mt-2">
            <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
        {!imageUrl && (
          <div className="w-24 h-24 rounded-xl border border-dashed border-border/60 overflow-hidden bg-muted flex items-center justify-center mt-2">
            <Package className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Posição e Ativo */}
      <div className="flex gap-4">
        <div className="space-y-1.5 flex-1">
          <label className="text-sm font-semibold text-foreground">Posição</label>
          <input
            type="number"
            value={position}
            onChange={e => setPosition(Number(e.target.value))}
            className="w-full px-4 py-3 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]/50 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Ativo</label>
          <div className="flex items-center gap-2 h-[50px]">
            <button
              type="button"
              onClick={() => setActive(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors ${active ? 'bg-[#6699F3]' : 'bg-border'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-6' : ''}`} />
            </button>
            <span className="text-sm text-muted-foreground">{active ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>
      </div>

      {/* Nichos */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Nichos</label>
        {niches.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum nicho cadastrado ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {niches.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => toggleNiche(n.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  selectedNiches.includes(n.id)
                    ? 'bg-[#6699F3] text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                {n.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cursos */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Cursos</label>
        <p className="text-xs text-muted-foreground">
          Marque os cursos onde este material é utilizado. A URL do curso pode ser colada direto numa aula:
          {' '}<code className="bg-muted px-1 rounded text-[11px]">/ferramentas/fornecedores?curso=slug-do-curso</code>
        </p>
        {courses.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum curso cadastrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {courses.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCourse(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors text-left ${
                  selectedCourses.includes(c.id)
                    ? 'bg-[#72CF92] text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fornecedores vinculados */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-foreground">Lojas e links de compra</label>
          <button
            type="button"
            onClick={addSupplierLink}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-[#6699F3]/40 text-[#6699F3] rounded-lg hover:bg-[#6699F3]/5 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Adicionar loja
          </button>
        </div>

        {supplierLinks.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nenhuma loja vinculada. Clique em "Adicionar loja" para vincular.
          </p>
        ) : (
          <div className="space-y-2">
            {supplierLinks.map((link, i) => (
              <div key={i} className="flex gap-2 items-start p-3 rounded-xl border border-border/60 bg-muted/20">
                <div className="flex-1 space-y-2">
                  {/* Seletor de fornecedor */}
                  <select
                    value={link.supplier_id}
                    onChange={e => updateSupplierLink(i, 'supplier_id', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                  >
                    <option value="">Selecionar loja…</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {/* URL do produto */}
                  <input
                    value={link.buy_url}
                    onChange={e => updateSupplierLink(i, 'buy_url', e.target.value)}
                    placeholder="https://... (link direto para o produto)"
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSupplierLink(i)}
                  className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Erro */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl border border-border/60 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-[#6699F3] text-white text-sm font-semibold hover:bg-[#5588e8] disabled:opacity-60 transition-colors"
        >
          {saving ? 'Salvando…' : product ? 'Salvar alterações' : 'Criar produto'}
        </button>
      </div>
    </form>
  )
}
