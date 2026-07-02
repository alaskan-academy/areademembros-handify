'use client'

import { useEffect, useState, useTransition } from 'react'
import { X, ChevronLeft, ChevronRight, User, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitize'
import { useModalBackGuard } from '@/hooks/useModalBackGuard'
import type { InspiracaoPost } from '@/lib/inspiracoes/types'
import { LikeButton } from './LikeButton'
import { BookmarkButton } from './BookmarkButton'
import { ComentariosPanel } from './ComentariosPanel'

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

function Carrossel({ images }: { images: { url: string; alt?: string }[] }) {
  const [idx, setIdx] = useState(0)
  if (!images.length) return null

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl bg-black">
        <img
          src={images[idx].url}
          alt={images[idx].alt ?? ''}
          className="w-full max-h-80 object-contain"
        />
      </div>
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="Próxima"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex justify-center gap-1.5 mt-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  i === idx ? 'bg-[#6699F3]' : 'bg-foreground/20'
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
  onClose: () => void
}

export function InspiracaoModal({ post, userId, onClose }: Props) {
  useModalBackGuard(true, onClose)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const ytId = post.type === 'video' && post.video_url ? getYouTubeId(post.video_url) : null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal
        aria-label={post.title}
        className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50 pointer-events-none"
      >
        <div className="pointer-events-auto w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-border/60 shrink-0">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{post.type}</p>
              <h2 className="font-bold text-base leading-snug">{post.title}</h2>
              {post.author && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  por {post.author.full_name ?? 'Handify'}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-4 space-y-4">

            {/* FOTO */}
            {post.type === 'foto' && post.media[0] && (
              <img
                src={post.media[0].url}
                alt={post.media[0].alt ?? post.title}
                className="w-full rounded-xl object-contain max-h-80 bg-black"
              />
            )}

            {/* CARROSSEL */}
            {post.type === 'carrossel' && <Carrossel images={post.media} />}

            {/* VÍDEO */}
            {post.type === 'video' && ytId && (
              <div className="aspect-video rounded-xl overflow-hidden bg-black">
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
              <a
                href={post.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[#6699F3] hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir vídeo
              </a>
            )}

            {/* RECEITA */}
            {post.type === 'receita' && post.recipe_data && (
              <div className="space-y-4">
                {post.media[0] && (
                  <img
                    src={post.media[0].url}
                    alt={post.title}
                    className="w-full rounded-xl object-cover max-h-56"
                  />
                )}

                {/* Meta */}
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

                {/* Paleta de cores */}
                {post.recipe_data.paleta_cores && post.recipe_data.paleta_cores.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Paleta de cores</p>
                    <div className="flex gap-2 flex-wrap">
                      {post.recipe_data.paleta_cores.map((hex, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div
                            className="w-9 h-9 rounded-lg border border-border/60 shadow-sm"
                            style={{ background: hex }}
                          />
                          <span className="text-[9px] text-muted-foreground font-mono">{hex}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ingredientes */}
                {post.recipe_data.ingredientes && post.recipe_data.ingredientes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Ingredientes</p>
                    <ul className="space-y-1">
                      {post.recipe_data.ingredientes.map((ing, i) => (
                        <li
                          key={i}
                          className="flex justify-between items-center text-xs text-foreground/80 py-1.5 border-b border-border/30 last:border-0"
                        >
                          <span>{ing.item}</span>
                          <span className="font-semibold text-foreground ml-4 shrink-0">{ing.quantidade}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Passos */}
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

                {/* Dicas */}
                {post.recipe_data.dicas && (
                  <div className="bg-[#72CF92]/10 rounded-xl p-3 border border-[#72CF92]/20">
                    <p className="text-xs font-semibold text-[#2a9d5a] mb-1">💡 Dicas</p>
                    <p className="text-xs text-foreground/75 leading-relaxed">{post.recipe_data.dicas}</p>
                  </div>
                )}

                {/* Custo / Preço */}
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
              <div className="space-y-3">
                {post.body && (
                  <p className="text-sm text-foreground/80 leading-relaxed">{post.body}</p>
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
                      <p className="font-bold text-lg">{post.featured_student.full_name ?? 'Aluna'}</p>
                      {post.featured_student.bio && (
                        <p className="text-sm text-foreground/70 mt-1 leading-relaxed max-w-sm mx-auto">
                          {post.featured_student.bio}
                        </p>
                      )}
                    </div>
                    {post.body && (
                      <div className="text-sm text-foreground/80 bg-muted rounded-xl p-4 text-left w-full leading-relaxed">
                        {post.body}
                      </div>
                    )}
                  </div>
                ) : (
                  post.body && (
                    <p className="text-sm text-foreground/80 leading-relaxed">{post.body}</p>
                  )
                )}
              </div>
            )}

            {/* Body text para tipos que não o tratam acima */}
            {!['dica', 'receita', 'destaque'].includes(post.type) && post.body && (
              <p className="text-sm text-foreground/80 leading-relaxed">{post.body}</p>
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

            {/* Comentários */}
            <div className="border-t border-border/60 pt-4">
              <ComentariosPanel postId={post.id} userId={userId} />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border/60 px-4 py-3 flex items-center gap-4 bg-white">
            <LikeButton
              postId={post.id}
              userId={userId}
              initialLiked={post.is_liked}
              initialCount={post.like_count}
              size="md"
            />
            <BookmarkButton
              postId={post.id}
              userId={userId}
              initialBookmarked={post.is_bookmarked}
              size="md"
            />
            <p className="text-xs text-muted-foreground ml-auto">
              {new Date(post.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
