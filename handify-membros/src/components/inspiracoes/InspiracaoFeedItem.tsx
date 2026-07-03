'use client'

import { useState } from 'react'
import {
  ChevronLeft, ChevronRight, ExternalLink, MessageCircle, User,
  Image as ImageIcon, PlayCircle, ChefHat, Lightbulb, Star, GalleryHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitize'
import type { InspiracaoPost, InspiracaoType } from '@/lib/inspiracoes/types'
import { LikeButton } from './LikeButton'
import { BookmarkButton } from './BookmarkButton'
import { ComentariosPanel } from './ComentariosPanel'

const TYPE_CONFIG: Record<InspiracaoType, { label: string; icon: React.ElementType; badge: string }> = {
  foto:      { label: 'Foto',      icon: ImageIcon,         badge: 'bg-blue-100 text-blue-700' },
  carrossel: { label: 'Carrossel', icon: GalleryHorizontal, badge: 'bg-purple-100 text-purple-700' },
  video:     { label: 'Vídeo',     icon: PlayCircle,        badge: 'bg-red-100 text-red-700' },
  receita:   { label: 'Receita',   icon: ChefHat,           badge: 'bg-orange-100 text-orange-700' },
  dica:      { label: 'Dica',      icon: Lightbulb,         badge: 'bg-amber-100 text-amber-700' },
  destaque:  { label: 'Destaque',  icon: Star,              badge: 'bg-green-100 text-green-700' },
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

function Carrossel({ images }: { images: { url: string; alt?: string }[] }) {
  const [idx, setIdx] = useState(0)
  if (!images.length) return null

  return (
    <div className="relative">
      <div className="overflow-hidden bg-white">
        <img
          src={images[idx].url}
          alt={images[idx].alt ?? ''}
          className="w-full max-h-[480px] object-contain"
        />
      </div>
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % images.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="Próxima"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex justify-center gap-1.5 py-2 bg-black/5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  i === idx ? 'bg-[#6699F3]' : 'bg-foreground/25'
                )}
                aria-label={`Imagem ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface Props {
  post: InspiracaoPost
  userId: string
}

export function InspiracaoFeedItem({ post, userId }: Props) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const { label, icon: Icon, badge } = TYPE_CONFIG[post.type]
  const ytId = post.type === 'video' && post.video_url ? getYouTubeId(post.video_url) : null

  return (
    <article className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">

      {/* Header do post */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#6699F3]/10 flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-[#6699F3]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', badge)}>
              <Icon className="w-2.5 h-2.5" />
              {label}
            </span>
            {post.pinned && (
              <span className="text-[10px] bg-[#FEC649] text-[#0F0F0F] px-1.5 py-0.5 rounded-full font-bold leading-none">
                📌 Fixado
              </span>
            )}
          </div>
          <h2 className="font-bold text-sm leading-snug mt-1">{post.title}</h2>
          {post.author && (
            <p className="text-xs text-muted-foreground mt-0.5">
              por {post.author.full_name ?? 'Handify'}
              {' · '}
              {new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
          {!post.author && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Mídia */}
      {post.type === 'foto' && post.media[0] && (
        <div className="bg-white">
          <img
            src={post.media[0].url}
            alt={post.media[0].alt ?? post.title}
            className="w-full max-h-[480px] object-contain"
          />
        </div>
      )}

      {post.type === 'carrossel' && post.media.length > 0 && (
        <Carrossel images={post.media} />
      )}

      {post.type === 'video' && ytId && (
        <div className="aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title={post.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
      {post.type === 'video' && !ytId && post.video_url && (
        <div className="px-4 pb-3">
          <a
            href={post.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#6699F3] hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir vídeo
          </a>
        </div>
      )}

      {/* Conteúdo */}
      <div className="px-4 pt-3 space-y-3">

        {/* RECEITA */}
        {post.type === 'receita' && post.recipe_data && (
          <div className="space-y-4">
            {post.media[0] && (
              <img
                src={post.media[0].url}
                alt={post.title}
                className="w-full rounded-xl object-cover max-h-64"
              />
            )}

            {(post.recipe_data.tempo || post.recipe_data.temperatura || post.recipe_data.nivel) && (
              <div className="flex flex-wrap gap-4 bg-muted/50 rounded-xl p-3">
                {post.recipe_data.tempo && (
                  <div className="text-xs">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Tempo</p>
                    <p className="font-semibold mt-0.5">{post.recipe_data.tempo}</p>
                  </div>
                )}
                {post.recipe_data.temperatura && (
                  <div className="text-xs">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Temperatura</p>
                    <p className="font-semibold mt-0.5">{post.recipe_data.temperatura}</p>
                  </div>
                )}
                {post.recipe_data.nivel && (
                  <div className="text-xs">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Nível</p>
                    <p className="font-semibold mt-0.5">{post.recipe_data.nivel}</p>
                  </div>
                )}
              </div>
            )}

            {post.recipe_data.paleta_cores && post.recipe_data.paleta_cores.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2">Paleta de cores</p>
                <div className="flex gap-2 flex-wrap">
                  {post.recipe_data.paleta_cores.map((hex, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 rounded-lg border border-border/60 shadow-sm" style={{ background: hex }} />
                      <span className="text-[9px] text-muted-foreground font-mono">{hex}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {post.recipe_data.ingredientes && post.recipe_data.ingredientes.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2">Ingredientes</p>
                <ul className="space-y-1">
                  {post.recipe_data.ingredientes.map((ing, i) => (
                    <li key={i} className="flex justify-between items-center text-xs text-foreground/80 py-1.5 border-b border-border/30 last:border-0">
                      <span>{ing.item}</span>
                      <span className="font-semibold text-foreground ml-4 shrink-0">{ing.quantidade}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {post.recipe_data.passos && post.recipe_data.passos.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2">Modo de preparo</p>
                <ol className="space-y-2.5">
                  {post.recipe_data.passos.map((passo, i) => (
                    <li key={i} className="flex gap-3 text-xs text-foreground/80 leading-relaxed">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#6699F3]/10 text-[#6699F3] font-bold flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      {passo}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {post.recipe_data.dicas && (
              <div className="bg-[#72CF92]/10 rounded-xl p-3 border border-[#72CF92]/20">
                <p className="text-xs font-semibold text-[#2a9d5a] mb-1">💡 Dicas</p>
                <p className="text-xs text-foreground/75 leading-relaxed">{post.recipe_data.dicas}</p>
              </div>
            )}

            {(post.recipe_data.custo_medio || post.recipe_data.preco_venda) && (
              <div className="flex gap-6">
                {post.recipe_data.custo_medio && (
                  <div className="text-xs">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Custo médio</p>
                    <p className="font-bold mt-0.5">{post.recipe_data.custo_medio}</p>
                  </div>
                )}
                {post.recipe_data.preco_venda && (
                  <div className="text-xs">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Preço de venda</p>
                    <p className="font-bold mt-0.5 text-[#6699F3]">{post.recipe_data.preco_venda}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* DICA */}
        {post.type === 'dica' && (
          <div className="space-y-2">
            {post.body && (
              <div
                className="prose prose-sm max-w-none text-foreground/80 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
              />
            )}
            {post.blocks.map((block, i) => {
              if (block.type === 'text') {
                return <p key={i} className="text-sm text-foreground/80 leading-relaxed">{block.content}</p>
              }
              if (block.type === 'html') {
                return (
                  <div
                    key={i}
                    className="prose prose-sm max-w-none text-foreground/80"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
                  />
                )
              }
              return null
            })}
          </div>
        )}

        {/* DESTAQUE */}
        {post.type === 'destaque' && (
          <div>
            {post.featured_student ? (
              <div className="flex flex-col items-center text-center gap-3 py-2">
                {post.featured_student.avatar_url ? (
                  <img
                    src={post.featured_student.avatar_url}
                    alt={post.featured_student.full_name ?? ''}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#6699F3]/30"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#6699F3]/10 flex items-center justify-center">
                    <User className="w-10 h-10 text-[#6699F3]/40" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-base">{post.featured_student.full_name ?? 'Aluna'}</p>
                  {post.featured_student.bio && (
                    <p className="text-sm text-foreground/70 mt-1 leading-relaxed max-w-sm mx-auto">
                      {post.featured_student.bio}
                    </p>
                  )}
                </div>
                {post.body && (
                  <div
                    className="prose prose-sm max-w-none text-foreground/80 bg-muted rounded-xl p-4 text-left w-full leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
                  />
                )}
              </div>
            ) : (
              post.body && (
                <div
                  className="prose prose-sm max-w-none text-foreground/80 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
                />
              )
            )}
          </div>
        )}

        {/* Body para demais tipos (foto, carrossel, video) */}
        {!['dica', 'receita', 'destaque'].includes(post.type) && post.body && (
          <div
            className="prose prose-sm max-w-none text-foreground/80 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
          />
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-[#6699F3]/8 text-[#6699F3] border border-[#6699F3]/20 font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="px-4 py-3 flex items-center gap-3 mt-1">
        <LikeButton
          postId={post.id}
          userId={userId}
          initialLiked={post.is_liked}
          initialCount={post.like_count}
          size="md"
        />
        <button
          onClick={() => setCommentsOpen(v => !v)}
          aria-expanded={commentsOpen}
          className={cn(
            'flex items-center gap-1.5 text-sm transition-colors min-h-[44px] px-1',
            commentsOpen ? 'text-[#6699F3]' : 'text-foreground/50 hover:text-foreground/80'
          )}
        >
          <MessageCircle className="w-5 h-5" />
          {post.comment_count > 0 && <span className="text-xs font-medium">{post.comment_count}</span>}
        </button>
        <div className="ml-auto">
          <BookmarkButton
            postId={post.id}
            userId={userId}
            initialBookmarked={post.is_bookmarked}
            size="md"
          />
        </div>
      </div>

      {/* Comentários expandíveis */}
      {commentsOpen && (
        <div className="px-4 pb-4 border-t border-border/60 pt-4">
          <ComentariosPanel postId={post.id} userId={userId} />
        </div>
      )}
    </article>
  )
}
