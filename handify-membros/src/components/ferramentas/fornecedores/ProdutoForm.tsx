'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Package, Upload, X } from 'lucide-react'
import { adminUpsertProduct, uploadProductImage } from '@/lib/fornecedores/actions'
import type { ProductWithDetails, SupplierRow } from '@/lib/fornecedores/types'

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
  suppliers: SupplierRow[]
  courses: CourseOption[]
}

export function ProdutoForm({ product, suppliers, courses }: Props) {
  const router = useRouter()

  const [name, setName] = useState(product?.name ?? '')
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [active, setActive] = useState(product?.active ?? true)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadProductImage(fd)
    setUploading(false)
    if ('error' in result) {
      setUploadError(result.error)
    } else {
      setImageUrl(result.url)
    }
    e.target.value = ''
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
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Foto do produto</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {imageUrl ? (
          <div className="flex items-start gap-4">
            <div className="w-28 h-28 rounded-xl border border-border/60 overflow-hidden bg-muted shrink-0">
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#6699F3]/40 text-[#6699F3] rounded-lg hover:bg-[#6699F3]/5 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Enviando…' : 'Trocar foto'}
              </button>
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border/60 text-muted-foreground rounded-lg hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Remover foto
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 hover:bg-[#6699F3]/5 hover:border-[#6699F3]/30 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <div className="w-6 h-6 border-2 border-[#6699F3]/30 border-t-[#6699F3] rounded-full animate-spin" />
            ) : (
              <Package className="w-8 h-8 text-muted-foreground/30" />
            )}
            <span className="text-xs text-muted-foreground">
              {uploading ? 'Enviando…' : 'Clique para fazer upload (JPG, PNG ou WebP, máx 5 MB)'}
            </span>
          </button>
        )}

        {uploadError && (
          <p className="text-xs text-red-600">{uploadError}</p>
        )}
      </div>

      {/* Ativo */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Ativo</label>
        <div className="flex items-center gap-2">
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

      {/* Lojas e links de compra */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-semibold text-foreground">Lojas e links de compra</label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Os nichos do produto são definidos automaticamente pelas tags das lojas vinculadas.
            </p>
          </div>
          <button
            type="button"
            onClick={addSupplierLink}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-[#6699F3]/40 text-[#6699F3] rounded-lg hover:bg-[#6699F3]/5 transition-colors shrink-0"
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

      {/* Cursos */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Cursos</label>
        <p className="text-xs text-muted-foreground">
          Marque os cursos onde este material é utilizado.{' '}
          <code className="bg-muted px-1 rounded text-[11px]">/ferramentas/fornecedores?curso=slug</code>
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
