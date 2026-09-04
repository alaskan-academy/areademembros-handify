'use client'

import { useState } from 'react'
import Link from 'next/link'
import { qtdTexto, type Unidade } from '@/lib/estoque/tipos'

/**
 * "Você tem 20 mL — faltam 16": compara o que a receita pede de essência com o
 * que está no Estoque. Só aparece para quem tem essência anotada lá (Completo).
 */
export type EssenciaEstoque = { id: string; name: string; quantity: number; unit: Unidade }

export default function TemNoEstoque({ essencias, precisaMl, precisaG, escuro = false }: { essencias: EssenciaEstoque[]; precisaMl: number; precisaG: number; escuro?: boolean }) {
  const [id, setId] = useState('')
  if (essencias.length === 0 || precisaG <= 0) return null
  const e = essencias.find(x => x.id === id)

  // Compara na unidade em que ela guarda: mL/L com os mililitros, g/kg com as gramas.
  let texto: string | null = null
  let falta = false
  if (e) {
    const emMl = e.unit === 'mL' || e.unit === 'L'
    const tem = e.unit === 'L' ? e.quantity * 1000 : e.unit === 'kg' ? e.quantity * 1000 : e.quantity
    const precisa = emMl ? precisaMl : precisaG
    const un = emMl ? 'mL' : 'g'
    if (e.unit === 'un') texto = `Você tem ${qtdTexto(e.quantity, e.unit)} — anote em mL ou g no estoque para eu comparar.`
    else if (tem >= precisa) {
      const lotes = Math.floor(tem / precisa)
      texto = `Você tem ${qtdTexto(e.quantity, e.unit)} = dá para ${lotes} lote${lotes !== 1 ? 's' : ''} como este.`
    } else {
      falta = true
      texto = `Você tem ${qtdTexto(e.quantity, e.unit)} — faltam ${(precisa - tem).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${un} para este lote.`
    }
  }

  const base = escuro ? 'text-gray-300' : 'text-muted-foreground'
  return (
    <div className={`text-xs ${base} space-y-1.5`}>
      <label className="flex flex-wrap items-center gap-2">
        Tem no estoque?
        <select value={id} onChange={ev => setId(ev.target.value)} aria-label="Essência do estoque" className={`rounded-lg border px-2 py-1.5 text-sm min-h-[36px] max-w-[220px] ${escuro ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-border text-foreground'}`}>
          <option value="">— escolher a essência —</option>
          {essencias.map(x => <option key={x.id} value={x.id}>{x.name} ({qtdTexto(x.quantity, x.unit)})</option>)}
        </select>
      </label>
      {texto && (
        <p className={falta ? (escuro ? 'text-[#FEC649] font-semibold' : 'text-[#C4704F] font-semibold') : ''}>
          {texto}{' '}
          {falta && <Link href="/ferramentas/fornecedores" className="underline">Ver fornecedores</Link>}
        </p>
      )}
    </div>
  )
}
