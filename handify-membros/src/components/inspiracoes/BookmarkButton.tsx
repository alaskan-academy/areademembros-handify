'use client'

import { useState, useTransition } from 'react'
import { Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleBookmark } from '@/lib/inspiracoes/actions'

interface Props {
  postId: string
  userId: string
  initialBookmarked: boolean
  size?: 'sm' | 'md'
}

export function BookmarkButton({ postId, userId, initialBookmarked, size = 'sm' }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [, startTransition] = useTransition()

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    const wasBookmarked = bookmarked
    setBookmarked(!wasBookmarked)
    startTransition(() => {
      toggleBookmark(userId, postId, wasBookmarked)
    })
  }

  const iconCls = size === 'md' ? 'w-5 h-5' : 'w-4 h-4'

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-1 transition-colors',
        bookmarked ? 'text-[#6699F3]' : 'text-foreground/50 hover:text-[#6699F3]'
      )}
      aria-label={bookmarked ? 'Remover dos salvos' : 'Salvar'}
    >
      <Bookmark className={cn(iconCls, bookmarked && 'fill-current')} />
    </button>
  )
}
