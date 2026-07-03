'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, X, Image as ImageIcon, Play, ChefHat,
  Lightbulb, Star, GalleryHorizontal, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminUpsertPost, adminDeletePost } from '@/lib/inspiracoes/actions'
import type { InspiracaoType, InspiracaoPostRow, ReceitaData } from '@/lib/inspiracoes/types'
import { ImageUploader } from './ImageUploader'

const RichTextEditor = dynamic(
  () => import('@/components/editor/RichTextEditor'),
  { ssr: false, loading: () => <div className="h-32 rounded-lg border border-border/60 bg-muted/30 animate-pulse" /> }
)

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: InspiracaoType; icon: any; label: string; desc: string }[] = [
  { value: 'foto',      icon: ImageIcon,          label: 'Foto',      desc: 'Imagem única com legenda' },
  { value: 'carrossel', icon: GalleryHorizontal,  label: 'Carrossel', desc: '2+ imagens swipeable' },
  { value: 'video',     icon: Play,               label: 'Vídeo',     desc: 'YouTube ou Panda Video' },
  { value: 'receita',   icon: ChefHat,            label: 'Receita',   desc: 'Ingredientes e passos' },
  { value: 'dica',      icon: Lightbulb,          label: 'Dica',      desc: 'Texto rico / HTML' },
  { value: 'destaque',  icon: Star,               label: 'Destaque',  desc: 'Aluna em destaque' },
]

const NICHO_TAGS = [
  { key: 'velas',      label: '🕯️ Velas' },
  { key: 'sabonetes',  label: '🧼 Sabonetes' },
  { key: 'costura',    label: '✂️ Costura' },
  { key: 'croche',     label: '🧶 Crochê' },
  { key: 'tricot',     label: '🧵 Tricô' },
  { key: 'macrame',    label: '🪢 Macramê' },
  { key: 'decoupage',  label: '🎨 Decoupage' },
  { key: 'pintura',    label: '🖌️ Pintura' },
]

const NIVEL_OPTIONS = ['Iniciante', 'Intermediário', 'Avançado']

const INPUT_CLS = "w-full px-3 py-2 text-sm rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3] bg-white"
const LABEL_CLS = "block text-xs font-medium text-foreground mb-1"

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  post?: InspiracaoPostRow
  adminId: string
  courses: { id: string; title: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InspiracaoForm({ post, adminId, courses }: Props) {
  const router = useRouter()
  const isEdit = !!post

  // Common fields
  const [type, setType]           = useState<InspiracaoType>(post?.type ?? 'foto')
  const [title, setTitle]         = useState(post?.title ?? '')
  const [body, setBody]           = useState(post?.body ?? '')
  const [tags, setTags]           = useState<Set<string>>(new Set(post?.tags ?? []))
  const [courseId, setCourseId]   = useState(post?.course_id ?? '')
  const [published, setPublished] = useState(post?.published ?? false)
  const [pinned, setPinned]       = useState(post?.pinned ?? false)
  const [archived, setArchived]   = useState(post?.archived ?? false)

  // Foto / Carrossel
  const initialUrls = post?.media?.length
    ? post.media.map((m: any) => m.url)
    : ['']
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialUrls)

  // Video
  const [videoUrl, setVideoUrl] = useState(post?.video_url ?? '')
  const [videoAspect, setVideoAspect] = useState<'16/9' | '9/16' | '1/1'>(
    ((post?.blocks ?? []).find((b: any) => b.type === 'video_meta')?.content as '16/9' | '9/16' | '1/1') ?? '16/9'
  )

  // Dica — bloco HTML
  const [htmlBlock, setHtmlBlock] = useState(
    (post?.blocks ?? []).find((b: any) => b.type === 'html')?.content ?? ''
  )

  // Dica / Destaque — imagem de capa opcional
  const [coverImage, setCoverImage] = useState(
    (post?.type === 'dica' || post?.type === 'destaque') ? (post?.media?.[0]?.url ?? '') : ''
  )

  // Receita
  const rd = post?.recipe_data as ReceitaData | undefined
  const [recipeMedia, setRecipeMedia]   = useState(post?.media?.[0]?.url ?? '')
  const [ingredientes, setIngredientes] = useState<{ item: string; quantidade: string }[]>(
    rd?.ingredientes?.length ? rd.ingredientes : [{ item: '', quantidade: '' }]
  )
  const [passos, setPassos]       = useState<string[]>(
    rd?.passos?.length ? rd.passos : (rd?.como_fazer?.length ? rd.como_fazer : [''])
  )
  const [tempo, setTempo]         = useState(rd?.tempo ?? '')
  const [temperatura, setTemperatura] = useState(rd?.temperatura ?? '')
  const [nivel, setNivel]         = useState(rd?.nivel ?? '')
  const [dicas, setDicas]         = useState(rd?.dicas ?? '')
  const [custoMedio, setCustoMedio]   = useState(rd?.custo_medio ?? '')
  const [precoVenda, setPrecoVenda]   = useState(rd?.preco_venda ?? '')

  // Destaque
  const [featuredStudentId, setFeaturedStudentId] = useState(post?.featured_student_id ?? '')

  const [loading, setLoading]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState('')

  // ── Ingredientes ────────────────────────────────────────────────────────────
  function addIngrediente() {
    setIngredientes(prev => [...prev, { item: '', quantidade: '' }])
  }
  function removeIngrediente(i: number) {
    setIngredientes(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateIngrediente(i: number, key: 'item' | 'quantidade', val: string) {
    setIngredientes(prev => prev.map((ing, idx) => idx === i ? { ...ing, [key]: val } : ing))
  }

  // ── Passos ──────────────────────────────────────────────────────────────────
  function addPasso() { setPassos(prev => [...prev, '']) }
  function removePasso(i: number) { setPassos(prev => prev.filter((_, idx) => idx !== i)) }
  function updatePasso(i: number, val: string) {
    setPassos(prev => prev.map((p, idx) => idx === i ? val : p))
  }

  // ── Media URLs (carrossel) ──────────────────────────────────────────────────
  function addMediaUrl() { setMediaUrls(prev => [...prev, '']) }
  function removeMediaUrl(i: number) { setMediaUrls(prev => prev.filter((_, idx) => idx !== i)) }
  function updateMediaUrl(i: number, val: string) {
    setMediaUrls(prev => prev.map((u, idx) => idx === i ? val : u))
  }

  // ── Tags ────────────────────────────────────────────────────────────────────
  function toggleTag(key: string) {
    setTags(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Título obrigatório.'); return }
    setLoading(true)
    setError('')

    try {
      // Monta media
      let media: { url: string; alt: string; order: number }[] = []
      if (type === 'foto') {
        if (mediaUrls[0]?.trim()) media = [{ url: mediaUrls[0].trim(), alt: title, order: 0 }]
      } else if (type === 'carrossel') {
        media = mediaUrls
          .map((u, i) => ({ url: u.trim(), alt: `${title} ${i + 1}`, order: i }))
          .filter(m => m.url)
      } else if (type === 'receita') {
        if (recipeMedia.trim()) media = [{ url: recipeMedia.trim(), alt: title, order: 0 }]
      } else if (type === 'dica' || type === 'destaque') {
        if (coverImage.trim()) media = [{ url: coverImage.trim(), alt: title, order: 0 }]
      }

      // Monta recipe_data
      let recipe_data = undefined
      if (type === 'receita') {
        recipe_data = {
          ingredientes: ingredientes.filter(ing => ing.item.trim()),
          passos: passos.filter(p => p.trim()),
          tempo: tempo.trim() || undefined,
          temperatura: temperatura.trim() || undefined,
          nivel: nivel || undefined,
          dicas: dicas.trim() || undefined,
          custo_medio: custoMedio.trim() || undefined,
          preco_venda: precoVenda.trim() || undefined,
        }
      }

      // Monta blocks
      let blocks: { type: 'html' | 'video_meta'; content: string; position: number }[] | undefined = undefined
      if (type === 'dica' && htmlBlock.trim()) {
        blocks = [{ type: 'html', content: htmlBlock.trim(), position: 0 }]
      }
      if (type === 'video') {
        blocks = [{ type: 'video_meta', content: videoAspect, position: 0 }]
      }

      await adminUpsertPost(adminId, {
        id: post?.id,
        type,
        title: title.trim(),
        body: body.trim() || undefined,
        media,
        video_url: type === 'video' ? videoUrl.trim() || undefined : undefined,
        blocks,
        recipe_data,
        tags: [...tags],
        course_id: courseId || undefined,
        featured_student_id: type === 'destaque' ? featuredStudentId.trim() || undefined : undefined,
        published,
        pinned,
        archived,
      })

      router.push('/admin/inspiracoes')
    } catch (err: any) {
      setError(err.message ?? 'Erro ao salvar.')
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!post?.id) return
    if (!confirm(`Excluir "${post.title}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    await adminDeletePost(post.id)
    router.push('/admin/inspiracoes')
  }

  // ── YouTube embed preview ────────────────────────────────────────────────────
  const ytId = type === 'video' ? getYouTubeId(videoUrl) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/inspiracoes" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold">
            {isEdit ? 'Editar post' : 'Novo post de inspiração'}
          </h1>
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

      {/* Tipo */}
      <div className="bg-white rounded-xl border border-border/60 p-5">
        <h2 className="text-sm font-semibold mb-3">Tipo de post</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TYPE_OPTIONS.map(opt => {
            const Icon = opt.icon
            const active = type === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors ${
                  active
                    ? 'border-[#6699F3] bg-[#6699F3]/8 text-[#6699F3]'
                    : 'border-border/60 hover:border-[#6699F3]/40 text-foreground'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  active ? 'bg-[#6699F3]/15' : 'bg-muted'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</p>
                </div>
                {active && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="bg-white rounded-xl border border-border/60 p-5 space-y-4">
        <h2 className="text-sm font-semibold">Conteúdo</h2>

        {/* Título */}
        <div>
          <label className={LABEL_CLS}>Título *</label>
          <input
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={INPUT_CLS}
            placeholder="Ex: Sabonete de Aloe Vera Marmorizado"
          />
        </div>

        {/* Legenda / corpo */}
        <div>
          <label className={LABEL_CLS}>Legenda / corpo</label>
          <RichTextEditor
            value={body}
            onChange={setBody}
            placeholder="Descrição do post, contexto, dicas gerais..."
            minHeight={120}
          />
        </div>

        {/* ── Mídia: foto ───────────────────────────────────────────────── */}
        {type === 'foto' && (
          <ImageUploader
            label="Imagem"
            value={mediaUrls[0] ?? ''}
            onChange={url => updateMediaUrl(0, url)}
          />
        )}

        {/* ── Mídia: carrossel ─────────────────────────────────────────── */}
        {type === 'carrossel' && (
          <div>
            <label className={LABEL_CLS}>Imagens do carrossel</label>
            <div className="space-y-4">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Imagem {i + 1}
                    </span>
                    {mediaUrls.length > 1 && (
                      <button type="button" onClick={() => removeMediaUrl(i)}
                        className="text-[10px] text-red-500 hover:underline flex items-center gap-1">
                        <X className="w-3 h-3" />
                        Remover
                      </button>
                    )}
                  </div>
                  <ImageUploader
                    value={url}
                    onChange={newUrl => updateMediaUrl(i, newUrl)}
                  />
                </div>
              ))}
              <button type="button" onClick={addMediaUrl}
                className="flex items-center gap-1.5 text-xs text-[#6699F3] hover:underline">
                <Plus className="w-3.5 h-3.5" />
                Adicionar imagem
              </button>
            </div>
          </div>
        )}

        {/* ── Vídeo ────────────────────────────────────────────────────── */}
        {type === 'video' && (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLS}>URL do vídeo (YouTube ou Panda Video)</label>
              <input
                type="url"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                className={INPUT_CLS}
                placeholder="https://youtube.com/watch?v=... ou https://player.pandavideo.com.br/..."
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Proporção do vídeo</label>
              <div className="flex gap-2">
                {([['16/9', 'Horizontal (16:9)'], ['9/16', 'Vertical (9:16)'], ['1/1', 'Quadrado (1:1)']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setVideoAspect(val)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      videoAspect === val
                        ? 'bg-[#6699F3] text-white border-[#6699F3]'
                        : 'bg-white text-foreground/70 border-border hover:border-[#6699F3]/50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {ytId && (
              <div className="rounded-xl overflow-hidden border border-border/40 aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {videoUrl && !ytId && videoUrl.includes('pandavideo') && (
              <div
                className="rounded-xl overflow-hidden border border-border/40"
                style={{ aspectRatio: videoAspect, maxHeight: '80vh' }}
              >
                <iframe src={videoUrl} className="w-full h-full" allowFullScreen style={{ border: 'none' }} />
              </div>
            )}
          </div>
        )}

        {/* ── Destaque ─────────────────────────────────────────────────── */}
        {type === 'destaque' && (
          <div className="space-y-4">
            <ImageUploader
              label="Imagem de capa (opcional)"
              value={coverImage}
              onChange={setCoverImage}
            />
            <div>
              <label className={LABEL_CLS}>ID da aluna em destaque (UUID do perfil)</label>
              <input
                value={featuredStudentId}
                onChange={e => setFeaturedStudentId(e.target.value)}
                className={INPUT_CLS}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Encontre o UUID da aluna na página de Alunas do admin.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Seção receita ─────────────────────────────────────────────────────── */}
      {type === 'receita' && (
        <div className="bg-white rounded-xl border border-border/60 p-5 space-y-5">
          <h2 className="text-sm font-semibold">Receita</h2>

          {/* Imagem da receita */}
          <div>
            <ImageUploader
              label="Imagem da receita"
              value={recipeMedia}
              onChange={setRecipeMedia}
            />
          </div>

          {/* Ingredientes */}
          <div>
            <label className={LABEL_CLS}>Ingredientes</label>
            <div className="space-y-2">
              {ingredientes.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={ing.item}
                    onChange={e => updateIngrediente(i, 'item', e.target.value)}
                    className={`${INPUT_CLS} flex-1`}
                    placeholder="Ex: Base glicerinada branca"
                  />
                  <input
                    value={ing.quantidade}
                    onChange={e => updateIngrediente(i, 'quantidade', e.target.value)}
                    className="w-32 shrink-0 px-3 py-2 text-sm rounded-lg border border-border/60 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3] bg-white"
                    placeholder="Ex: 300g"
                  />
                  {ingredientes.length > 1 && (
                    <button type="button" onClick={() => removeIngrediente(i)}
                      className="p-2 text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addIngrediente}
                className="flex items-center gap-1.5 text-xs text-[#6699F3] hover:underline">
                <Plus className="w-3.5 h-3.5" />
                Adicionar ingrediente
              </button>
            </div>
          </div>

          {/* Passos */}
          <div>
            <label className={LABEL_CLS}>Passos / Como fazer</label>
            <div className="space-y-2">
              {passos.map((passo, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    <span className="mt-2.5 text-xs font-bold text-muted-foreground w-5 shrink-0 text-right">
                      {i + 1}.
                    </span>
                    <textarea
                      value={passo}
                      onChange={e => updatePasso(i, e.target.value)}
                      rows={2}
                      className={`${INPUT_CLS} resize-none flex-1`}
                      placeholder={`Passo ${i + 1}...`}
                    />
                  </div>
                  {passos.length > 1 && (
                    <button type="button" onClick={() => removePasso(i)}
                      className="p-2 text-muted-foreground hover:text-red-500 transition-colors shrink-0 mt-1">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addPasso}
                className="flex items-center gap-1.5 text-xs text-[#6699F3] hover:underline">
                <Plus className="w-3.5 h-3.5" />
                Adicionar passo
              </button>
            </div>
          </div>

          {/* Metadados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Nível</label>
              <select value={nivel} onChange={e => setNivel(e.target.value)} className={INPUT_CLS}>
                <option value="">Selecionar...</option>
                {NIVEL_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Tempo</label>
              <input value={tempo} onChange={e => setTempo(e.target.value)}
                className={INPUT_CLS} placeholder="Ex: 45 min" />
            </div>
            <div>
              <label className={LABEL_CLS}>Temperatura</label>
              <input value={temperatura} onChange={e => setTemperatura(e.target.value)}
                className={INPUT_CLS} placeholder="Ex: 65°C–70°C (derretimento)" />
            </div>
            <div>
              <label className={LABEL_CLS}>Custo médio</label>
              <input value={custoMedio} onChange={e => setCustoMedio(e.target.value)}
                className={INPUT_CLS} placeholder="Ex: R$ 3,20 por barra" />
            </div>
            <div>
              <label className={LABEL_CLS}>Preço de venda sugerido</label>
              <input value={precoVenda} onChange={e => setPrecoVenda(e.target.value)}
                className={INPUT_CLS} placeholder="Ex: R$ 15 – R$ 22" />
            </div>
          </div>

          {/* Dicas */}
          <div>
            <label className={LABEL_CLS}>Dica da receita</label>
            <textarea
              value={dicas}
              onChange={e => setDicas(e.target.value)}
              rows={3}
              className={`${INPUT_CLS} resize-none`}
              placeholder="Dica importante para o sucesso da receita..."
            />
          </div>
        </div>
      )}

      {/* ── Seção dica (bloco HTML) ──────────────────────────────────────────── */}
      {type === 'dica' && (
        <div className="bg-white rounded-xl border border-border/60 p-5 space-y-4">
          <h2 className="text-sm font-semibold">Conteúdo Rico</h2>
          <ImageUploader
            label="Imagem de capa (opcional)"
            value={coverImage}
            onChange={setCoverImage}
          />
          <div>
            <label className={LABEL_CLS}>Conteúdo</label>
            <RichTextEditor
              value={htmlBlock}
              onChange={setHtmlBlock}
              placeholder="Digite o conteúdo da dica..."
              minHeight={200}
            />
          </div>
        </div>
      )}

      {/* Tags de nicho */}
      <div className="bg-white rounded-xl border border-border/60 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Tags de nicho</h2>
        <div className="flex flex-wrap gap-2">
          {NICHO_TAGS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleTag(key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                tags.has(key)
                  ? 'bg-[#6699F3] text-white border-[#6699F3]'
                  : 'bg-white text-muted-foreground border-border/60 hover:border-[#6699F3]/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Curso relacionado */}
      {courses.length > 0 && (
        <div className="bg-white rounded-xl border border-border/60 p-5">
          <h2 className="text-sm font-semibold mb-3">Curso relacionado (opcional)</h2>
          <select value={courseId} onChange={e => setCourseId(e.target.value)} className={INPUT_CLS}>
            <option value="">Nenhum</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Opções de publicação */}
      <div className="bg-white rounded-xl border border-border/60 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Opções</h2>
        <Toggle label="Publicado" value={published} onChange={setPublished} />
        <Toggle label="Fixado no topo do feed" value={pinned} onChange={setPinned} />
        {isEdit && <Toggle label="Arquivado" value={archived} onChange={setArchived} />}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Link href="/admin/inspiracoes"
          className="flex-1 text-center py-2.5 text-sm font-medium border border-border/60 rounded-lg hover:bg-muted transition-colors">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 text-sm font-medium bg-[#6699F3] text-white rounded-lg hover:bg-[#5588e8] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar post'}
        </button>
      </div>
    </form>
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
