'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleLike } from '@/lib/inspiracoes/actions'

interface Props {
  postId: string
  userId: string
  initialLiked: boolean
  initialCount: number
  size?: 'sm' | 'md'
}

export function LikeButton({ postId, userId, initialLiked, initialCount, size = 'sm' }: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [, startTransition] = useTransition()

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    const wasLiked = liked
    setLiked(!wasLiked)
    setCount(c => wasLiked ? c - 1 : c + 1)
    startTransition(() => {
      toggleLike(userId, postId, wasLiked)
    })
  }

  const iconCls = size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  const textCls = size === 'md' ? 'text-sm' : 'text-xs'

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-1 transition-colors',
        textCls,
        liked ? 'text-red-500' : 'text-foreground/50 hover:text-red-400'
      )}
      aria-label={liked ? 'Descurtir' : 'Curtir'}
    >
      <Heart className={cn(iconCls, liked && 'fill-current')} />
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
