'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Pencil, Lock, Sparkles, Check, X, Minus, PackagePlus, AlertTriangle, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { salvarInsumo, moverInsumo, excluirInsumo, type Insumo } from '@/lib/estoque/actions'
import { CATEGORIAS, CATEGORIA_NOME, UNIDADES, qtdTexto, custoTexto, situacao, type Categoria, type Unidade } from '@/lib/estoque/tipos'

/**
 * Estoque de insumos — quanto tem de cada material, o que está acabando e o
 * que vence. No card, os atalhos do dia a dia: "Usei" e "Comprei". A validade
 * anotada aqui aparece na ferramenta de Validade ("puxar do estoque").
 * Sem plano ativo: vê tudo, não edita ("nunca some, só congela").
 */

const INPUT = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'
const n = (s: string) => Math.max(0, parseFloat(String(s).replace(',', '.')) || 0)
const nOuNulo = (s: string) => (s.trim() === '' ? null : n(s))

type Filtro = 'todos' | 'acabando' | 'vencendo' | Categoria

export default function Estoque({ insumos: iniciais, podeEditar, planLink }: { insumos: Insumo[]; podeEditar: boolean; planLink: string | null }) {
  const [insumos, setInsumos] = useState<Insumo[]>(iniciais)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [editando, setEditando] = useState<string | 'novo' | null>(null)
  const [movendo, setMovendo] = useState<{ id: string; tipo: 'usei' | 'comprei'; valor: string } | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [pending, start] = useTransition()
  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const comSituacao = useMemo(() => insumos.map(i => ({ ...i, s: situacao(i) })), [insumos])
  const acabando = comSituacao.filter(i => i.s.acabando)
  const vencendo = comSituacao.filter(i => i.s.validade)
  const categoriasUsadas = CATEGORIAS.filter(c => insumos.some(i => i.category === c))

  const visiveis = comSituacao.filter(i =>
    filtro === 'todos' ? true : filtro === 'acabando' ? i.s.acabando : filtro === 'vencendo' ? !!i.s.validade : i.category === filtro
  )

  function aoSalvar(i: Insumo) {
    setInsumos(l => (l.some(x => x.id === i.id) ? l.map(x => (x.id === i.id ? i : x)) : [...l, i]).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    setEditando(null)
    avisar('Insumo salvo.')
  }

  function mover() {
    if (!movendo) return
    const delta = n(movendo.valor) * (movendo.tipo === 'usei' ? -1 : 1)
    if (delta === 0) { setMovendo(null); return }
    start(async () => {
      const r = await moverInsumo(movendo.id, delta)
      if (r.error) { setErro(r.error); return }
      setInsumos(l => l.map(x => (x.id === movendo.id ? { ...x, quantity: r.quantity ?? x.quantity } : x)))
      setMovendo(null)
      setErro('')
      avisar(movendo.tipo === 'usei' ? 'Baixa feita.' : 'Entrada feita.')
    })
  }

  function apagar(id: string) {
    start(async () => {
      const r = await excluirInsumo(id)
      if (r.error) { setErro(r.error); return }
      setInsumos(l => l.filter(x => x.id !== id))
      setConfirmando(null)
      avisar('Insumo apagado.')
    })
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Ferramentas
        </Link>
        <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
          Estoque de <span className="text-[#6699F3]">insumos</span>
        </h1>

        {!podeEditar && (
          <div className="rounded-xl bg-[#FEC649]/15 border border-[#FEC649]/60 px-4 py-3 text-sm flex items-start gap-3">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Seu estoque continua aqui.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Com o Handify Completo ativo você volta a dar baixa e anotar compras.</p>
              {planLink && (
                <a href={planLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6699F3] underline mt-1 min-h-[36px]">
                  <Sparkles className="w-3.5 h-3.5" /> Renovar o Completo
                </a>
              )}
            </div>
          </div>
        )}

        {insumos.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setFiltro(f => (f === 'acabando' ? 'todos' : 'acabando'))} className={cn('bg-white rounded-2xl border p-3 text-left', filtro === 'acabando' ? 'border-[#6699F3]' : 'border-border/60')}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acabando</p>
              <p className={cn('font-black text-lg leading-tight mt-0.5', acabando.length && 'text-[#C4704F]')}>{acabando.length} insumo{acabando.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">{acabando.length ? 'abaixo do mínimo' : 'tudo abastecido'}</p>
            </button>
            <button onClick={() => setFiltro(f => (f === 'vencendo' ? 'todos' : 'vencendo'))} className={cn('bg-white rounded-2xl border p-3 text-left', filtro === 'vencendo' ? 'border-[#6699F3]' : 'border-border/60')}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Vencendo</p>
              <p className={cn('font-black text-lg leading-tight mt-0.5', vencendo.length && 'text-red-600')}>{vencendo.length} insumo{vencendo.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">{vencendo.length ? 'em 30 dias ou vencidos' : 'nada para 30 dias'}</p>
            </button>
          </div>
        )}

        {podeEditar && editando !== 'novo' && (
          <button onClick={() => { setEditando('novo'); setErro('') }} className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[48px] hover:bg-[#5580d4] handify-transition">
            <Plus className="w-4 h-4" /> Novo insumo
          </button>
        )}
        {editando === 'novo' && <InsumoForm onCancel={() => setEditando(null)} onSaved={aoSalvar} />}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {categoriasUsadas.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFiltro('todos')} className={cn('rounded-full border px-3 text-xs font-semibold min-h-[36px]', filtro === 'todos' ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border bg-white text-muted-foreground')}>Todos</button>
            {categoriasUsadas.map(c => (
              <button key={c} onClick={() => setFiltro(c)} className={cn('rounded-full border px-3 text-xs font-semibold min-h-[36px]', filtro === c ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border bg-white text-muted-foreground')}>{CATEGORIA_NOME[c]}</button>
            ))}
          </div>
        )}

        {insumos.length === 0 && editando !== 'novo' ? (
          <div className="bg-white rounded-2xl border border-border/60 p-8 text-center space-y-2">
            <p className="text-3xl">📦</p>
            <p className="font-semibold">Nenhum insumo ainda</p>
            <p className="text-sm text-muted-foreground">Anote o que tem na prateleira: quanto, o mínimo para avisar e a validade da embalagem.</p>
          </div>
        ) : visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nada nesse filtro.</p>
        ) : (
          <div className="space-y-2">
            {visiveis.map(i => {
              const custo = custoTexto(i.cost, i.cost_quantity, i.unit)
              return (
                <div key={i.id} className="bg-white rounded-2xl border border-border/60 p-4 space-y-2">
                  {editando === i.id ? (
                    <InsumoForm insumo={i} onCancel={() => setEditando(null)} onSaved={aoSalvar} />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-[15px] leading-tight">{i.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {CATEGORIA_NOME[i.category]}
                            {i.supplier && <> — {i.supplier}</>}
                          </p>
                        </div>
                        <p className={cn('font-black text-lg tabular-nums shrink-0', i.s.zerado && 'text-red-600')}>{qtdTexto(i.quantity, i.unit)}</p>
                      </div>
                      {(i.s.acabando || i.s.validade || custo || i.min_quantity != null) && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {i.s.acabando && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FEC649]/25"><AlertTriangle className="w-3 h-3" /> {i.s.zerado ? 'Acabou' : 'Acabando'}</span>
                          )}
                          {i.s.validade && (
                            <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full', i.s.validade === 'vencido' ? 'bg-red-100 text-red-700' : 'bg-[#FEC649]/25')}>
                              <CalendarClock className="w-3 h-3" /> {i.s.validade === 'vencido' ? `Venceu há ${-i.s.dias!} dia${-i.s.dias! !== 1 ? 's' : ''}` : i.s.dias === 0 ? 'Vence hoje' : `Vence em ${i.s.dias} dia${i.s.dias !== 1 ? 's' : ''}`}
                            </span>
                          )}
                          {!i.s.validade && i.expires_at && <span className="text-[11px] text-muted-foreground">vence {i.expires_at.split('-').reverse().join('/')}</span>}
                          {i.min_quantity != null && !i.s.acabando && <span className="text-[11px] text-muted-foreground">mínimo {qtdTexto(i.min_quantity, i.unit)}</span>}
                          {custo && <span className="text-[11px] text-muted-foreground">{custo}</span>}
                        </div>
                      )}
                      {i.notes && <p className="text-xs text-muted-foreground italic">{i.notes}</p>}
                      {podeEditar && movendo?.id === i.id && (
                        <form onSubmit={e => { e.preventDefault(); mover() }} className="flex items-center gap-2 rounded-lg bg-[#F5F5F0] p-2">
                          <span className="text-sm font-semibold">{movendo.tipo === 'usei' ? 'Usei' : 'Comprei'}</span>
                          <input autoFocus value={movendo.valor} onChange={e => setMovendo({ ...movendo, valor: e.target.value })} inputMode="decimal" placeholder="0" aria-label="Quantidade" className="w-24 rounded-lg border border-border bg-white px-3 py-2 text-sm min-h-[44px]" />
                          <span className="text-sm text-muted-foreground">{i.unit}</span>
                          <button type="submit" disabled={pending} className="ml-auto rounded-lg bg-[#6699F3] text-white text-sm font-semibold px-3 min-h-[44px] disabled:opacity-60">Ok</button>
                          <button type="button" onClick={() => setMovendo(null)} className="rounded-lg border border-border px-3 min-h-[44px]"><X className="w-4 h-4" /></button>
                        </form>
                      )}
                      {podeEditar && movendo?.id !== i.id && (
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={() => setMovendo({ id: i.id, tipo: 'usei', valor: '' })} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-semibold min-h-[44px]">
                            <Minus className="w-4 h-4" /> Usei
                          </button>
                          <button onClick={() => setMovendo({ id: i.id, tipo: 'comprei', valor: '' })} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#6699F3] text-[#6699F3] text-sm font-semibold min-h-[44px]">
                            <PackagePlus className="w-4 h-4" /> Comprei
                          </button>
                          <button onClick={() => { setEditando(i.id); setErro('') }} aria-label={`Editar ${i.name}`} className="w-11 h-11 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {confirmando === i.id ? (
                            <>
                              <button onClick={() => apagar(i.id)} disabled={pending} className="rounded-lg bg-red-600 text-white text-sm font-semibold px-3 min-h-[44px] disabled:opacity-60">Apagar</button>
                              <button onClick={() => setConfirmando(null)} className="rounded-lg border border-border text-sm px-3 min-h-[44px]">Não</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmando(i.id)} aria-label={`Apagar ${i.name}`} className="w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#0F0F0F] text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">{toast}</div>
        )}
      </div>
    </div>
  )
}

function InsumoForm({ insumo, onCancel, onSaved }: { insumo?: Insumo; onCancel: () => void; onSaved: (i: Insumo) => void }) {
  const [nome, setNome] = useState(insumo?.name ?? '')
  const [categoria, setCategoria] = useState<Categoria>(insumo?.category ?? 'outros')
  const [quantidade, setQuantidade] = useState(insumo ? String(insumo.quantity).replace('.', ',') : '')
  const [unidade, setUnidade] = useState<Unidade>(insumo?.unit ?? 'g')
  const [minimo, setMinimo] = useState(insumo?.min_quantity != null ? String(insumo.min_quantity).replace('.', ',') : '')
  const [validade, setValidade] = useState(insumo?.expires_at ?? '')
  const [custo, setCusto] = useState(insumo?.cost != null ? String(insumo.cost).replace('.', ',') : '')
  const [custoQtd, setCustoQtd] = useState(insumo?.cost_quantity != null ? String(insumo.cost_quantity).replace('.', ',') : '')
  const [fornecedor, setFornecedor] = useState(insumo?.supplier ?? '')
  const [notas, setNotas] = useState(insumo?.notes ?? '')
  const [erro, setErro] = useState('')
  const [pending, start] = useTransition()

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        start(async () => {
          const r = await salvarInsumo({
            id: insumo?.id,
            name: nome,
            category: categoria,
            quantity: n(quantidade),
            unit: unidade,
            min_quantity: nOuNulo(minimo),
            expires_at: validade || null,
            cost: nOuNulo(custo),
            cost_quantity: nOuNulo(custoQtd),
            supplier: fornecedor,
            notes: notas,
          })
          if (r.error || !r.insumo) { setErro(r.error ?? 'Não deu para salvar.'); return }
          onSaved(r.insumo)
        })
      }}
      className="space-y-3 rounded-xl bg-[#F5F5F0] p-3"
    >
      <p className="font-bold">{insumo ? 'Editar insumo' : 'Novo insumo'}</p>
      <label className="block text-xs font-medium text-muted-foreground">Nome<input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Base glicerinada branca" className={INPUT} maxLength={80} required /></label>
      <label className="block text-xs font-medium text-muted-foreground">
        Categoria
        <select value={categoria} onChange={e => setCategoria(e.target.value as Categoria)} className={INPUT}>
          {CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIA_NOME[c]}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-[1.4fr_1fr] gap-3">
        <label className="block text-xs font-medium text-muted-foreground">Quanto tem<input value={quantidade} onChange={e => setQuantidade(e.target.value)} inputMode="decimal" placeholder="Ex.: 1200" className={INPUT} required /></label>
        <label className="block text-xs font-medium text-muted-foreground">
          Unidade
          <select value={unidade} onChange={e => setUnidade(e.target.value as Unidade)} className={INPUT}>
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted-foreground">Avisar abaixo de<input value={minimo} onChange={e => setMinimo(e.target.value)} inputMode="decimal" placeholder={`Ex.: 300 ${unidade}`} className={INPUT} /></label>
        <label className="block text-xs font-medium text-muted-foreground">Validade da embalagem<input type="date" value={validade} onChange={e => setValidade(e.target.value)} className={INPUT} /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted-foreground">Paguei (R$)<input value={custo} onChange={e => setCusto(e.target.value)} inputMode="decimal" placeholder="Ex.: 45,00" className={INPUT} /></label>
        <label className="block text-xs font-medium text-muted-foreground">Por quanto ({unidade})<input value={custoQtd} onChange={e => setCustoQtd(e.target.value)} inputMode="decimal" placeholder="Ex.: 1000" className={INPUT} /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted-foreground">Fornecedor (opcional)<input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Ex.: Loja da Vila" className={INPUT} maxLength={80} /></label>
        <label className="block text-xs font-medium text-muted-foreground">Observação (opcional)<input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ex.: lote 2, cheiro forte" className={INPUT} maxLength={300} /></label>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] disabled:opacity-60"><Check className="w-4 h-4" /> {pending ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 text-sm min-h-[44px]"><X className="w-4 h-4" /></button>
      </div>
    </form>
  )
}
