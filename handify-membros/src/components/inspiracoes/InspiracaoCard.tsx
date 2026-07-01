'use client'

import { MessageCircle, Image as ImageIcon, PlayCircle, ChefHat, Lightbulb, Star, GalleryHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InspiracaoPost, InspiracaoType } from '@/lib/inspiracoes/types'
import { LikeButton } from './LikeButton'
import { BookmarkButton } from './BookmarkButton'

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

function CardThumbnail({ post }: { post: InspiracaoPost }) {
  if (post.type === 'video' && post.video_url) {
    const ytId = getYouTubeId(post.video_url)
    if (ytId) {
      return (
        <div className="relative aspect-square bg-black overflow-hidden">
          <img
            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
            alt={post.title}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow">
              <PlayCircle className="w-5 h-5 text-red-600 fill-red-600" />
            </div>
          </div>
        </div>
      )
    }
  }

  const firstMedia = post.media[0]
  if (firstMedia?.url) {
    return (
      <div className="aspect-square overflow-hidden bg-muted">
        <img
          src={firstMedia.url}
          alt={firstMedia.alt ?? post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
    )
  }

  const { icon: Icon } = TYPE_CONFIG[post.type]
  return (
    <div className="aspect-square flex items-center justify-center bg-muted">
      <Icon className="w-10 h-10 text-muted-foreground/25" />
    </div>
  )
}

interface Props {
  post: InspiracaoPost
  userId: string
  onClick: () => void
}

export function InspiracaoCard({ post, userId, onClick }: Props) {
  const { label, icon: Icon, badge } = TYPE_CONFIG[post.type]

  return (
    <article
      onClick={onClick}
      className="group bg-white rounded-xl border border-border/60 overflow-hidden cursor-pointer hover:border-[#6699F3]/40 hover:shadow-md transition-all duration-200"
    >
      <div className="relative">
        <CardThumbnail post={post} />
        <span className={cn('absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold', badge)}>
          <Icon className="w-2.5 h-2.5" />
          {label}
        </span>
        {post.pinned && (
          <span className="absolute top-2 right-2 text-[10px] bg-[#FEC649] text-[#0F0F0F] px-1.5 py-0.5 rounded-full font-bold leading-none">
            📌
          </span>
        )}
        {post.type === 'carrossel' && post.media.length > 1 && (
          <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full font-medium">
            1/{post.media.length}
          </span>
        )}
      </div>

      <div className="p-2.5">
        <p className="text-[11px] font-semibold leading-snug mb-1.5 line-clamp-2 text-foreground">
          {post.title}
        </p>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {post.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <LikeButton
            postId={post.id}
            userId={userId}
            initialLiked={post.is_liked}
            initialCount={post.like_count}
          />
          <span className="flex items-center gap-1 text-xs text-foreground/50">
            <MessageCircle className="w-4 h-4" />
            {post.comment_count > 0 && post.comment_count}
          </span>
          <div className="ml-auto">
            <BookmarkButton
              postId={post.id}
              userId={userId}
              initialBookmarked={post.is_bookmarked}
            />
          </div>
        </div>
      </div>
    </article>
  )
}
