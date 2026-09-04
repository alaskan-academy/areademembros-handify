'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Lock, Sparkles, Check, X, Truck, Megaphone, Hammer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { salvarEvento, excluirEvento, type Evento } from '@/lib/calendario/actions'
import { PRODUZ, proximasDatas, prazosPara, diffDias, dataBR, type Produz, type DataVenda } from '@/lib/calendario/datas'

/**
 * Calendário do artesanato — as datas que vendem no ano e quando começar a
 * produzir para chegar a tempo, pelo que ela faz (cold process cura 4 a 6
 * semanas; vela de soja descansa 1 a 2 semanas). As datas dela (feira,
 * encomenda grande) entram na mesma linha do tempo.
 */

const PREF = 'handify_calendario_pref'
const INPUT = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function diaSemana(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return DIAS_SEMANA[new Date(y, m - 1, d).getDay()]
}
function faltam(dias: number) {
  if (dias === 0) return 'é hoje'
  if (dias === 1) return 'é amanhã'
  if (dias < 0) return `passou há ${-dias} dia${-dias !== 1 ? 's' : ''}`
  if (dias < 60) return `faltam ${dias} dias`
  const meses = Math.round(dias / 30.44)
  return `faltam ${meses} ${meses === 1 ? 'mês' : 'meses'}`
}

type Item = { key: string; nome: string; emoji: string; data: string; dica: string | null; peso: 'alta' | 'media' | null; evento?: Evento }

export default function Calendario({ eventos: iniciais, podeEditar, planLink, produzInicial }: { eventos: Evento[]; podeEditar: boolean; planLink: string | null; produzInicial: Produz[] }) {
  const [produz, setProduz] = useState<Produz[]>(produzInicial)
  const [envia, setEnvia] = useState(false)
  const [eventos, setEventos] = useState<Evento[]>(iniciais)
  const [novo, setNovo] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [pending, start] = useTransition()
  const [carregou, setCarregou] = useState(false)
  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  // Preferências no aparelho (o que faz, se manda pelos Correios).
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREF) || 'null') as { produz?: Produz[]; envia?: boolean } | null
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (p?.produz?.length) setProduz(p.produz.filter(x => PRODUZ.some(q => q.key === x)))
      if (p?.envia != null) setEnvia(p.envia)
    } catch {}
    setCarregou(true)
  }, [])
  useEffect(() => {
    if (!carregou) return
    try { localStorage.setItem(PREF, JSON.stringify({ produz, envia })) } catch {}
  }, [produz, envia, carregou])

  const hoje = hojeISO()
  const itens = useMemo<Item[]>(() => {
    const comerciais: Item[] = proximasDatas(hoje, produz).map((d: DataVenda) => ({ key: `c-${d.slug}-${d.data}`, nome: d.nome, emoji: d.emoji, data: d.data, dica: d.dica, peso: d.peso }))
    const meus: Item[] = eventos.filter(e => e.date >= hoje).map(e => ({ key: `e-${e.id}`, nome: e.title, emoji: '📌', data: e.date, dica: e.notes, peso: null, evento: e }))
    return [...comerciais, ...meus].sort((a, b) => (a.data < b.data ? -1 : 1))
  }, [hoje, produz, eventos])

  const proxima = itens[0]
  const prazosProxima = proxima ? prazosPara(proxima.data, produz, envia) : null

  function apagar(id: string) {
    start(async () => {
      const r = await excluirEvento(id)
      if (r.error) { setErro(r.error); return }
      setEventos(l => l.filter(e => e.id !== id))
      setConfirmando(null)
      avisar('Data apagada.')
    })
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Ferramentas
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
            Calendário do <span className="text-[#6699F3]">artesanato</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">As datas que vendem e quando começar a produzir para chegar a tempo — pelo que você faz.</p>
        </div>

        {!podeEditar && (
          <div className="rounded-xl bg-[#FEC649]/15 border border-[#FEC649]/60 px-4 py-3 text-sm flex items-start gap-3">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Suas datas continuam aqui.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Com o Handify Completo ativo você volta a anotar feiras e encomendas.</p>
              {planLink && (
                <a href={planLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6699F3] underline mt-1 min-h-[36px]">
                  <Sparkles className="w-3.5 h-3.5" /> Renovar o Completo
                </a>
              )}
            </div>
          </div>
        )}

        {/* O que ela faz — define os prazos */}
        <section className="bg-white rounded-2xl border border-border/60 p-4 space-y-3">
          <p className="font-bold">O que você faz?</p>
          <div className="grid grid-cols-2 gap-2">
            {PRODUZ.map(p => {
              const ativo = produz.includes(p.key)
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setProduz(l => (ativo ? l.filter(x => x !== p.key) : [...l, p.key]))}
                  className={cn('rounded-lg border text-left px-3 py-2 min-h-[44px] handify-transition', ativo ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border bg-white text-muted-foreground')}
                >
                  <span className="block text-sm font-semibold">{p.emoji} {p.nome}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.explica}</span>
                </button>
              )
            })}
          </div>
          <label className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer min-h-[44px]', envia ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border')}>
            <input type="checkbox" checked={envia} onChange={e => setEnvia(e.target.checked)} className="w-4 h-4 accent-[#6699F3]" />
            <Truck className="w-4 h-4 shrink-0" />
            <span className="text-sm"><b>Mando pelos Correios</b> <span className="text-muted-foreground">= mais 7 dias de folga</span></span>
          </label>
        </section>

        {/* Próxima data em destaque */}
        {proxima && prazosProxima && (
          <section className="bg-[#0F0F0F] text-white rounded-2xl p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Próxima data</p>
            <p className="text-2xl font-black leading-tight">
              {proxima.emoji} {proxima.nome} <span className="text-[#72CF92]">— {dataBR(proxima.data)}, {faltam(diffDias(hoje, proxima.data))}</span>
            </p>
            <Prazo hoje={hoje} prazos={prazosProxima} escuro />
          </section>
        )}

        {podeEditar && !novo && (
          <button onClick={() => { setNovo(true); setErro('') }} className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[48px] hover:bg-[#5580d4] handify-transition">
            <Plus className="w-4 h-4" /> Minha data (feira, encomenda grande)
          </button>
        )}
        {novo && <EventoForm onCancel={() => setNovo(false)} onSaved={e => { setEventos(l => [...l, e].sort((a, b) => (a.date < b.date ? -1 : 1))); setNovo(false); avisar('Data anotada.') }} />}
        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {/* Linha do tempo */}
        <div className="space-y-2">
          {itens.map(item => {
            const dias = diffDias(hoje, item.data)
            const prazos = prazosPara(item.data, produz, envia)
            return (
              <div key={item.key} className={cn('bg-white rounded-2xl border p-4 space-y-2', item.evento ? 'border-[#6699F3]/50' : 'border-border/60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[15px] leading-tight">{item.emoji} {item.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{dataBR(item.data, true)}, {diaSemana(item.data)} — {faltam(dias)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.peso === 'alta' && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#72CF92]/25">Data forte</span>}
                    {item.evento && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#6699F3]/15">Sua data</span>}
                  </div>
                </div>
                <Prazo hoje={hoje} prazos={prazos} />
                {item.dica && <p className="text-xs text-muted-foreground">{item.dica}</p>}
                {item.evento && podeEditar && (
                  <div className="flex items-center gap-2">
                    {confirmando === item.evento.id ? (
                      <>
                        <button onClick={() => apagar(item.evento!.id)} disabled={pending} className="rounded-lg bg-red-600 text-white text-sm font-semibold px-3 min-h-[44px] disabled:opacity-60">Apagar</button>
                        <button onClick={() => setConfirmando(null)} className="rounded-lg border border-border text-sm px-3 min-h-[44px]">Não</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmando(item.evento!.id)} aria-label={`Apagar ${item.nome}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600 min-h-[36px]">
                        <Trash2 className="w-3.5 h-3.5" /> Apagar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#0F0F0F] text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">{toast}</div>
        )}
      </div>
    </div>
  )
}

/** "Comece a produzir até…" e "Divulgue a partir de…" com a cor do aperto. */
function Prazo({ hoje, prazos, escuro = false }: { hoje: string; prazos: ReturnType<typeof prazosPara>; escuro?: boolean }) {
  const dProd = diffDias(hoje, prazos.produzirAte)
  const dDiv = diffDias(hoje, prazos.divulgarAte)
  const cor = (d: number) => (d < 0 ? (escuro ? 'text-[#FEC649]' : 'text-[#C4704F]') : d <= 7 ? (escuro ? 'text-[#FEC649]' : 'text-[#C4704F]') : escuro ? 'text-white/85' : 'text-foreground')
  const quando = (d: number, data: string) =>
    d < 0 ? `o ideal era até ${dataBR(data)} — se ainda dá, comece hoje` : d === 0 ? 'comece hoje' : d === 1 ? 'comece amanhã' : `comece até ${dataBR(data)} (em ${d} dias)`
  return (
    <div className={cn('text-sm space-y-1', escuro ? 'text-white/85' : '')}>
      <p className={cn('flex items-start gap-2', cor(dProd))}>
        <Hammer className="w-4 h-4 shrink-0 mt-0.5" />
        <span><b>Produzir:</b> {quando(dProd, prazos.produzirAte)}</span>
      </p>
      <p className={cn('flex items-start gap-2', cor(dDiv))}>
        <Megaphone className="w-4 h-4 shrink-0 mt-0.5" />
        <span><b>Divulgar:</b> {quando(dDiv, prazos.divulgarAte)}</span>
      </p>
      <p className={cn('text-[11px]', escuro ? 'text-white/55' : 'text-muted-foreground')}>{prazos.antecedencia} dias de antecedência — {prazos.motivo}.</p>
    </div>
  )
}

function EventoForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (e: Evento) => void }) {
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [notas, setNotas] = useState('')
  const [erro, setErro] = useState('')
  const [pending, start] = useTransition()
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        start(async () => {
          const r = await salvarEvento({ title: titulo, date: data, notes: notas })
          if (r.error || !r.evento) { setErro(r.error ?? 'Não deu para salvar.'); return }
          onSaved(r.evento)
        })
      }}
      className="space-y-3 rounded-xl bg-white border border-border/60 p-4"
    >
      <p className="font-bold">Minha data</p>
      <label className="block text-xs font-medium text-muted-foreground">O que é<input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Feira da praça, encomenda da escola" className={INPUT} maxLength={80} required /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted-foreground">Quando<input type="date" value={data} onChange={e => setData(e.target.value)} className={INPUT} required /></label>
        <label className="block text-xs font-medium text-muted-foreground">Observação<input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ex.: 50 sabonetes" className={INPUT} maxLength={300} /></label>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] disabled:opacity-60"><Check className="w-4 h-4" /> {pending ? 'Salvando…' : 'Anotar'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 text-sm min-h-[44px]"><X className="w-4 h-4" /></button>
      </div>
    </form>
  )
}
