'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Lock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reais, numero } from '@/lib/ferramentas/calc'
import { excluirReceita, type ReceitaResumo } from '@/lib/receitas/actions'

/**
 * Lista do que ela guardou na conta. Abrir leva ao fluxo com a receita
 * carregada; apagar pede confirmação. Sem o plano ativo (venceu), tudo fica
 * visível mas nada se edita — "nunca some, só congela".
 */
export default function MinhasReceitas({
  receitas,
  podeEditar,
  planLink,
}: {
  receitas: ReceitaResumo[]
  podeEditar: boolean
  planLink: string | null
}) {
  const [lista, setLista] = useState(receitas)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [pending, start] = useTransition()

  function apagar(id: string) {
    start(async () => {
      const r = await excluirReceita(id)
      if (r.error) { setErro(r.error); return }
      setLista(l => l.filter(x => x.id !== id))
      setConfirmando(null)
    })
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Ferramentas
        </Link>
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
            Minhas <span className="text-[#6699F3]">receitas</span>
          </h1>
          <span className="text-xs text-muted-foreground">{lista.length} guardada{lista.length !== 1 ? 's' : ''}</span>
        </div>

        {!podeEditar && (
          <div className="rounded-xl bg-[#FEC649]/15 border border-[#FEC649]/60 px-4 py-3 text-sm flex items-start gap-3">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Suas receitas continuam aqui.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Com o Handify Completo ativo você volta a criar e editar.</p>
              {planLink && (
                <a href={planLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6699F3] underline mt-1 min-h-[36px]">
                  <Sparkles className="w-3.5 h-3.5" /> Renovar o Completo
                </a>
              )}
            </div>
          </div>
        )}

        {podeEditar && (
          <Link href="/ferramentas/minha-receita?nova=1" className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] hover:bg-[#5580d4] handify-transition">
            <Plus className="w-4 h-4" /> Nova receita
          </Link>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {lista.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border/60 p-8 text-center space-y-2">
            <p className="text-3xl">📒</p>
            <p className="font-semibold">Nenhuma receita guardada ainda</p>
            <p className="text-sm text-muted-foreground">Monte uma em Minha receita e, na ficha, toque em &quot;Guardar na conta&quot;.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-border/60 p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center text-xl shrink-0">
                    {r.product === 'velas' ? '🕯️' : '🧼'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] leading-tight truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.units} {r.product === 'velas' ? 'velas' : 'sabonetes'}
                      {r.unit_weight ? ` de ${numero(Number(r.unit_weight), 0)} g` : ''}
                      {' — '}atualizada em {new Date(r.updated_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Celula v={r.cost_per_unit != null ? reais(Number(r.cost_per_unit)) : '—'} l="custo" />
                  <Celula v={r.price != null ? reais(Number(r.price)) : '—'} l="preço" destaque />
                  <Celula v={r.margin != null ? `${r.margin}%` : '—'} l="margem" />
                </div>
                {(r.aroma || r.wick) && (
                  <p className="text-xs text-muted-foreground">
                    {[r.aroma, r.wick ? `Pavio ${r.wick}` : null].filter(Boolean).join(' — ')}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/ferramentas/minha-receita?receita=${r.id}`}
                    className={cn('flex-1 inline-flex items-center justify-center rounded-lg text-sm font-semibold min-h-[44px]', podeEditar ? 'bg-[#6699F3] text-white hover:bg-[#5580d4]' : 'border border-border')}
                  >
                    {podeEditar ? 'Abrir' : 'Ver'}
                  </Link>
                  {podeEditar && (confirmando === r.id ? (
                    <>
                      <button onClick={() => apagar(r.id)} disabled={pending} className="rounded-lg bg-red-600 text-white text-sm font-semibold px-3 min-h-[44px] disabled:opacity-60">Apagar</button>
                      <button onClick={() => setConfirmando(null)} className="rounded-lg border border-border text-sm px-3 min-h-[44px]">Não</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmando(r.id)} aria-label={`Apagar ${r.name}`} className="w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Celula({ v, l, destaque }: { v: string; l: string; destaque?: boolean }) {
  return (
    <div className={cn('rounded-lg py-1.5', destaque ? 'bg-[#6699F3] text-white' : 'bg-[#F5F5F0]')}>
      <div className="font-black tabular-nums">{v}</div>
      <div className={cn('text-[10px]', destaque ? 'text-white/80' : 'text-muted-foreground')}>{l}</div>
    </div>
  )
}
