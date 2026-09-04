'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Search, X, ChevronDown, Wrench, ShieldCheck, HelpCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRODUTOS_PROBLEMA, buscarProblemas, type ProdutoProblema } from '@/lib/ferramentas/problemas'

/**
 * Deu problema? — ela descreve o que viu ("afundou", "pontos laranja"), e sai a
 * causa, o que dá para corrigir agora e como evitar na próxima. Gratuita.
 */
export default function DeuProblema({ produtoInicial }: { produtoInicial: ProdutoProblema | null }) {
  const [produto, setProduto] = useState<ProdutoProblema | null>(produtoInicial)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const lista = useMemo(() => buscarProblemas(produto, busca), [produto, busca])

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Ferramentas
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
            Deu <span className="text-[#6699F3]">problema?</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Afundou, rachou, fez túnel, suou — a causa, o que dá para corrigir agora e como evitar na próxima.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setProduto(null)} aria-pressed={produto === null} className={cn('rounded-full border px-3 text-xs font-semibold min-h-[36px]', produto === null ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border bg-white text-muted-foreground')}>Tudo</button>
          {PRODUTOS_PROBLEMA.map(p => (
            <button key={p.key} onClick={() => setProduto(p.key)} aria-pressed={produto === p.key} className={cn('rounded-full border px-3 text-xs font-semibold min-h-[36px]', produto === p.key ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border bg-white text-muted-foreground')}>
              {p.emoji} {p.nome}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="O que aconteceu? Ex.: afundou, pontos laranja, suou…" aria-label="Descreva o problema" className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 min-h-[44px]" />
          {busca && (
            <button onClick={() => setBusca('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          )}
        </div>

        {lista.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border/60 p-8 text-center space-y-2">
            <p className="text-3xl">🔍</p>
            <p className="font-semibold">Não achei esse problema</p>
            <p className="text-sm text-muted-foreground">Tente outra palavra (ex.: &quot;buraco&quot;, &quot;manchas&quot;) ou pergunte no fórum do curso — a professora responde.</p>
            <Link href="/comunidade/forum" className="inline-flex items-center gap-1 text-sm font-semibold text-[#6699F3] underline min-h-[44px]">Ir ao fórum</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map(p => {
              const abertoAqui = aberto === p.id
              const info = PRODUTOS_PROBLEMA.find(x => x.key === p.produto)!
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-border/60 overflow-hidden">
                  <button onClick={() => setAberto(abertoAqui ? null : p.id)} aria-expanded={abertoAqui} className="w-full flex items-center justify-between gap-3 p-4 text-left min-h-[56px]">
                    <div className="min-w-0">
                      <p className="font-bold text-[15px] leading-tight">{p.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{info.emoji} {info.nome}{!abertoAqui && <> — {p.sinais}</>}</p>
                    </div>
                    <ChevronDown className={cn('w-4 h-4 shrink-0 text-muted-foreground handify-transition', abertoAqui && 'rotate-180')} />
                  </button>
                  {abertoAqui && (
                    <div className="px-4 pb-4 space-y-3 text-sm">
                      <Bloco icone={<HelpCircle className="w-4 h-4" />} titulo="Por que aconteceu" itens={p.causas} />
                      <Bloco icone={<Wrench className="w-4 h-4" />} titulo="Dá para corrigir agora?" itens={p.corrigir} destaque />
                      <Bloco icone={<ShieldCheck className="w-4 h-4" />} titulo="Na próxima" itens={p.evitar} />
                      {p.link && (
                        <Link href={p.link.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6699F3] min-h-[44px]">
                          {p.link.texto} <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center">Não achou ou não resolveu? O fórum do seu curso é o lugar: a professora vê a foto e responde.</p>
      </div>
    </div>
  )
}

function Bloco({ icone, titulo, itens, destaque = false }: { icone: React.ReactNode; titulo: string; itens: string[]; destaque?: boolean }) {
  return (
    <div className={cn('rounded-lg p-3', destaque ? 'bg-[#6699F3]/10' : 'bg-[#F5F5F0]')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">{icone} {titulo}</p>
      <ul className="space-y-1 list-disc pl-4">
        {itens.map(i => <li key={i}>{i}</li>)}
      </ul>
    </div>
  )
}
