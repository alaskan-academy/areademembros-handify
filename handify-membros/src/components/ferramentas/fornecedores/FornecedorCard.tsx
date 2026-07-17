'use client'

import { useState } from 'react'
import { Heart, ExternalLink, Camera, ShoppingBag, MessageCircle, Globe, BadgeCheck, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleFavorite } from '@/lib/fornecedores/actions'
import { CHANNEL_LABELS, CATEGORY_TAGS } from '@/lib/fornecedores/types'
import type { SupplierWithDetails, Channel } from '@/lib/fornecedores/types'

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  website:      <Globe className="w-3.5 h-3.5" />,
  instagram:    <Camera className="w-3.5 h-3.5" />,
  shopee:       <ShoppingBag className="w-3.5 h-3.5" />,
  mercadolivre: <ShoppingBag className="w-3.5 h-3.5" />,
}

const CHANNEL_COLORS: Record<Channel, string> = {
  website:      'bg-[#6699F3]/10 text-[#6699F3] hover:bg-[#6699F3]/20',
  instagram:    'bg-pink-50 text-pink-600 hover:bg-pink-100',
  shopee:       'bg-orange-50 text-orange-600 hover:bg-orange-100',
  mercadolivre: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
}

interface LinkedProduct {
  name: string
  buy_url: string
  image_url: string | null
}

interface Props {
  supplier: SupplierWithDetails
  userId: string
  onOpenReviews: (supplier: SupplierWithDetails) => void
  linkedProducts?: LinkedProduct[]
}

export function FornecedorCard({ supplier, userId, onOpenReviews, linkedProducts = [] }: Props) {
  const [fav, setFav] = useState(supplier.isFavorite)
  const [loading, setLoading] = useState(false)

  async function handleFav() {
    if (loading) return
    setLoading(true)
    setFav(v => !v)
    try {
      await toggleFavorite(userId, supplier.id, fav)
    } catch {
      setFav(v => !v) // revert on error
    }
    setLoading(false)
  }

  const categoryTags = supplier.tags.filter(t => t in CATEGORY_TAGS)
  const nicheTags = supplier.tags.filter(t => !(t in CATEGORY_TAGS))

  return (
    <div className="bg-white rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        {/* Logo */}
        <div className="shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border/40">
          {supplier.logo_url ? (
            <img src={supplier.logo_url} alt={supplier.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-xl">{supplier.name[0]}</span>
          )}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-sm text-foreground truncate">{supplier.name}</h3>
            {supplier.verified && (
              <BadgeCheck className="w-4 h-4 text-[#6699F3] shrink-0" aria-label="Verificado Handify" />
            )}
          </div>

          {/* Niche tags (from categories) */}
          {nicheTags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1">
              {nicheTags.map(t => (
                <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#72CF92]/15 text-green-700 capitalize">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Favorite */}
        <button
          onClick={handleFav}
          disabled={loading}
          className={cn(
            'shrink-0 p-1.5 rounded-lg transition-colors',
            fav ? 'text-red-500 hover:bg-red-50' : 'text-foreground/30 hover:text-red-400 hover:bg-red-50'
          )}
          title={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart className="w-4 h-4" fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Description */}
      {supplier.description && (
        <p className="px-4 text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {supplier.description}
        </p>
      )}

      {/* Category tags */}
      {categoryTags.length > 0 && (
        <div className="px-4 mt-2.5 flex flex-wrap gap-1">
          {categoryTags.map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
              {CATEGORY_TAGS[t as keyof typeof CATEGORY_TAGS]}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Canais — todos os links disponíveis */}
      {supplier.channels.length > 0 && (
        <div className="px-4 mt-3 flex flex-wrap gap-1.5">
          {supplier.channels.map(ch => (
            <a
              key={ch.channel}
              href={ch.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                CHANNEL_COLORS[ch.channel as Channel]
              )}
            >
              {CHANNEL_ICONS[ch.channel as Channel]}
              {CHANNEL_LABELS[ch.channel as Channel]}
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          ))}
        </div>
      )}

      {/* Produtos vinculados */}
      {linkedProducts.length > 0 && (
        <div className="px-4 mt-3 pt-3 border-t border-border/40">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Produtos disponíveis
          </p>
          <div className="flex flex-col gap-1.5">
            {linkedProducts.map((p, i) => (
              <a
                key={i}
                href={p.buy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 group"
              >
                <div className="w-8 h-8 rounded-md border border-border/40 bg-muted overflow-hidden shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-3.5 h-3.5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <span className="text-xs text-foreground group-hover:text-[#6699F3] transition-colors flex-1 leading-snug line-clamp-1">
                  {p.name}
                </span>
                <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-[#6699F3] transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Footer: review count */}
      <div className="px-4 py-3 mt-3 border-t border-border/40 flex items-center justify-between">
        <button
          onClick={() => onOpenReviews(supplier)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {supplier.reviewCount === 0
            ? 'Seja a primeira a comentar'
            : `${supplier.reviewCount} comentário${supplier.reviewCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
