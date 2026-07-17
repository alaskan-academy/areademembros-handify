'use client'

import { cn } from '@/lib/utils'
import type { NicheRow } from '@/lib/fornecedores/types'

interface Props {
  niches: NicheRow[]
  selected: string // niche id or '' for all
  onChange: (id: string) => void
}

export function NichePills({ niches, selected, onChange }: Props) {
  if (niches.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange('')}
        className={cn(
          'px-4 py-2 rounded-full text-sm font-semibold transition-colors min-h-[40px]',
          selected === ''
            ? 'bg-[#6699F3] text-white shadow-sm'
            : 'bg-white border border-border/60 text-foreground hover:border-[#6699F3]/40 hover:text-[#6699F3]'
        )}
      >
        Todos
      </button>
      {niches.map(niche => (
        <button
          key={niche.id}
          onClick={() => onChange(niche.id)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-semibold transition-colors min-h-[40px]',
            selected === niche.id
              ? 'bg-[#6699F3] text-white shadow-sm'
              : 'bg-white border border-border/60 text-foreground hover:border-[#6699F3]/40 hover:text-[#6699F3]'
          )}
        >
          {niche.name}
        </button>
      ))}
    </div>
  )
}
