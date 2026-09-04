'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Target, AlertTriangle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reais } from '@/lib/ferramentas/calc'
import { calcularMeta } from '@/lib/ferramentas/meta'

/**
 * Meta de renda — quanto vender, a que preço, para ganhar o que ela quer por
 * mês. Responde na hora. Quem tem catálogo entra com preço e custo médios já
 * preenchidos; quem não tem, digita.
 */

const INPUT = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'
const n = (s: string) => Math.max(0, parseFloat(String(s).replace(',', '.')) || 0)

function Campo({ rotulo, children, dica }: { rotulo: string; children: React.ReactNode; dica?: string }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {rotulo}
      {children}
      {dica && <span className="block text-[11px] font-normal mt-1">{dica}</span>}
    </label>
  )
}

export default function MetaDeRenda({ precoInicial, custoInicial }: { precoInicial: number | null; custoInicial: number | null }) {
  const [meta, setMeta] = useState('2000')
  const [preco, setPreco] = useState(precoInicial ? String(precoInicial).replace('.', ',') : '')
  const [custo, setCusto] = useState(custoInicial ? String(custoInicial).replace('.', ',') : '')
  const [horas, setHoras] = useState('')
  const [minutos, setMinutos] = useState('')
  const [dias, setDias] = useState(5)

  const r = useMemo(
    () =>
      n(meta) > 0 && n(preco) > 0
        ? calcularMeta({ metaMes: n(meta), precoMedio: n(preco), custoMedio: n(custo), horasSemana: horas ? n(horas) : null, minutosPorUnidade: minutos ? n(minutos) : null, diasPorSemana: dias })
        : null,
    [meta, preco, custo, horas, minutos, dias]
  )

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Ferramentas
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
            Meta de <span className="text-[#6699F3]">renda</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Quanto vender, a que preço, para ganhar o que você quer por mês.</p>
        </div>

        <section className="bg-white rounded-2xl border border-border/60 p-4 space-y-3">
          <Campo rotulo="Quanto você quer ganhar por mês, limpo (R$)">
            <input value={meta} onChange={e => setMeta(e.target.value)} inputMode="decimal" placeholder="Ex.: 2000" className={INPUT} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Preço médio de venda (R$)" dica={precoInicial ? 'Veio do seu catálogo.' : undefined}>
              <input value={preco} onChange={e => setPreco(e.target.value)} inputMode="decimal" placeholder="Ex.: 25" className={INPUT} />
            </Campo>
            <Campo rotulo="Custo médio por peça (R$)" dica={custoInicial ? 'Veio das suas receitas.' : 'Insumos + embalagem. Não sabe? Minha receita calcula.'}>
              <input value={custo} onChange={e => setCusto(e.target.value)} inputMode="decimal" placeholder="Ex.: 10" className={INPUT} />
            </Campo>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-border/60 p-4 space-y-3">
          <p className="font-bold">Cabe no seu tempo? <span className="text-xs font-normal text-muted-foreground">(opcional)</span></p>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Horas por semana que você tem"><input value={horas} onChange={e => setHoras(e.target.value)} inputMode="decimal" placeholder="Ex.: 20" className={INPUT} /></Campo>
            <Campo rotulo="Minutos para fazer e embalar 1 peça"><input value={minutos} onChange={e => setMinutos(e.target.value)} inputMode="decimal" placeholder="Ex.: 15" className={INPUT} /></Campo>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Dias por semana</p>
            <div className="flex gap-1.5">
              {[3, 4, 5, 6, 7].map(d => (
                <button key={d} type="button" onClick={() => setDias(d)} aria-pressed={dias === d} className={cn('flex-1 rounded-lg border text-sm font-semibold min-h-[44px]', dias === d ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border bg-white text-muted-foreground')}>{d}</button>
              ))}
            </div>
          </div>
        </section>

        {r && r.unidadesMes > 0 && (
          <section className="bg-[#0F0F0F] text-white rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Para ganhar {reais(n(meta))} por mês</p>
              <p className="text-3xl font-black leading-tight mt-1">{r.unidadesMes} peças <span className="text-[#72CF92]">= {r.unidadesSemana} por semana = {r.unidadesDia} por dia</span></p>
              <p className="text-sm text-white/80 mt-1">Lucro de {reais(r.lucroUnidade)} por peça ({r.margemPct}% do preço). Faturamento no mês: {reais(r.faturamentoMes)}.</p>
            </div>
            {r.horasNecessariasSemana != null && (
              <p className={cn('text-sm rounded-lg px-3 py-2', r.cabe === false ? 'bg-[#FEC649]/20 text-[#FEC649]' : 'bg-white/10 text-white/85')}>
                Isso pede {r.horasNecessariasSemana.toLocaleString('pt-BR')} h por semana{horas ? ` — você tem ${n(horas).toLocaleString('pt-BR')} h` : ''}{r.cabe === true ? ': cabe.' : r.cabe === false ? ': não cabe.' : '.'}
              </p>
            )}
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60 mb-2">E se o preço subir?</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {r.cenarios.map(c => (
                  <div key={c.rotulo} className="rounded-lg bg-white/10 p-2">
                    <p className="text-[11px] text-white/60">{c.rotulo}</p>
                    <p className="text-sm font-bold">{reais(c.preco)}</p>
                    <p className="text-[11px] text-white/80">{c.unidadesMes} peças</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {r && r.alertas.length > 0 && (
          <div className="space-y-2">
            {r.alertas.map((a, i) => (
              <div key={i} className={cn('rounded-xl border px-4 py-3 text-sm flex items-start gap-3', r.unidadesMes === 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-[#FEC649]/15 border-[#FEC649]/60')}>
                {r.unidadesMes === 0 ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />}
                <p>{a}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link href="/ferramentas/minha-receita?etapa=preco" className="inline-flex items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold min-h-[44px] text-center px-2">Acertar o preço</Link>
          <Link href="/ferramentas/calendario" className="inline-flex items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold min-h-[44px] text-center px-2">Datas que vendem</Link>
        </div>
      </div>
    </div>
  )
}
