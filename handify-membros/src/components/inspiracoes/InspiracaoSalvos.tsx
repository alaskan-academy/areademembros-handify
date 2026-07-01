'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import type { InspiracaoPost } from '@/lib/inspiracoes/types'
import { InspiracaoCard } from './InspiracaoCard'
import { InspiracaoModal } from './InspiracaoModal'

interface Props {
  posts: InspiracaoPost[]
  userId: string
}

export function InspiracaoSalvos({ posts, userId }: Props) {
  const [selected, setSelected] = useState<InspiracaoPost | null>(null)

  if (posts.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium text-sm">Nenhuma inspiração salva ainda</p>
        <p className="text-xs mt-1">Toque no ícone de bookmark para salvar</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {posts.map(post => (
          <InspiracaoCard
            key={post.id}
            post={post}
            userId={userId}
            onClick={() => setSelected(post)}
          />
        ))}
      </div>

      {selected && (
        <InspiracaoModal
          post={selected}
          userId={userId}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
