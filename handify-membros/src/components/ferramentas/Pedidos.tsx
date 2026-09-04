'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Pencil, Lock, Sparkles, Check, X, MessageCircle, PackageCheck, Truck, HandCoins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reais } from '@/lib/ferramentas/calc'
import { salvarProduto } from '@/lib/catalogo/actions'
import {
  salvarPedido,
  atualizarPedido,
  excluirPedido,
  excluirCliente,
  type Pedido,
  type Cliente,
  type ProdutoOpcao,
  type StatusPedido,
} from '@/lib/pedidos/actions'

/**
 * Pedidos e clientes — quem pediu o que, para quando, e quanto falta receber.
 * Um pedido nasce de quem pediu + itens (do catálogo ou digitados) + data de
 * entrega. No card, os atalhos do dia a dia: "Ficou pronto", "Entregue",
 * "Recebi tudo". Sem plano ativo: vê tudo, não edita ("nunca some, só congela").
 */

const INPUT = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'
const n = (s: string) => Math.max(0, parseFloat(String(s).replace(',', '.')) || 0)
const inteiro = (s: string) => Math.max(0, Math.floor(parseFloat(s) || 0))
const arred = (v: number) => Math.round(v * 100) / 100

const STATUS: Record<StatusPedido, string> = { a_fazer: 'A fazer', pronto: 'Pronto', entregue: 'Entregue' }
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function diasAte(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const [hy, hm, hd] = hojeISO().split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86400000)
}
function dataCurta(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
function diaSemana(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return DIAS[new Date(y, m - 1, d).getDay()]
}

type Tom = 'atrasado' | 'hoje' | 'perto' | 'normal' | 'entregue' | 'sem'
function prazo(p: Pedido): { texto: string; tom: Tom } {
  if (p.status === 'entregue') {
    return { texto: p.delivered_at ? `Entregue em ${new Date(p.delivered_at).toLocaleDateString('pt-BR')}` : 'Entregue', tom: 'entregue' }
  }
  if (!p.due_date) return { texto: 'Sem data de entrega', tom: 'sem' }
  const d = diasAte(p.due_date)
  if (d < 0) return { texto: `Atrasado há ${-d} dia${-d !== 1 ? 's' : ''}`, tom: 'atrasado' }
  if (d === 0) return { texto: 'Entrega hoje', tom: 'hoje' }
  if (d === 1) return { texto: 'Entrega amanhã', tom: 'perto' }
  if (d <= 7) return { texto: `Entrega ${diaSemana(p.due_date)} (${dataCurta(p.due_date)})`, tom: 'perto' }
  return { texto: `Entrega em ${dataCurta(p.due_date)}`, tom: 'normal' }
}

function pagamento(p: Pedido): { texto: string; pago: boolean; falta: number } {
  const falta = Math.max(0, arred(p.total - p.paid_amount))
  if (p.total > 0 && falta === 0) return { texto: 'Pago', pago: true, falta: 0 }
  if (p.paid_amount > 0) return { texto: `Sinal ${reais(p.paid_amount)} = faltam ${reais(falta)}`, pago: false, falta }
  return { texto: `A receber ${reais(falta)}`, pago: false, falta }
}

function linkWhats(w: string | null) {
  if (!w) return null
  const d = w.replace(/\D/g, '')
  if (d.length < 10) return null
  return `https://wa.me/${d.startsWith('55') && d.length >= 12 ? d : '55' + d}`
}

function ordenar(lista: Pedido[]) {
  return [...lista].sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1
    if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1
    return a.created_at < b.created_at ? 1 : -1
  })
}

type Aba = 'abertos' | 'entregues' | 'clientes'

export default function Pedidos({
  pedidos: iniciais,
  clientes: clientesIniciais,
  produtos,
  podeEditar,
  planLink,
}: {
  pedidos: Pedido[]
  clientes: Cliente[]
  produtos: ProdutoOpcao[]
  podeEditar: boolean
  planLink: string | null
}) {
  const [pedidos, setPedidos] = useState<Pedido[]>(iniciais)
  // Catálogo local: cresce quando um item digitado vira produto ("adicionar ao catálogo").
  const [catalogo, setCatalogo] = useState<ProdutoOpcao[]>(produtos)
  const noCatalogo = (nome: string) => catalogo.some(p => p.name.trim().toLowerCase() === nome.trim().toLowerCase())
  function adicionarAoCatalogo(nome: string, preco: number) {
    start(async () => {
      const r = await salvarProduto({ recipe_id: null, name: nome, description: '', price: preco, active: true })
      if (r.error || !r.id) { setErro(r.error ?? 'Não deu para adicionar.'); return }
      setCatalogo(l => [...l, { id: r.id!, name: nome.trim(), price: preco }])
      avisar('Adicionado ao catálogo.')
    })
  }
  const [clientesBase, setClientesBase] = useState(clientesIniciais.map(c => ({ id: c.id, name: c.name, whatsapp: c.whatsapp })))
  const [aba, setAba] = useState<Aba>('abertos')
  const [clienteFiltro, setClienteFiltro] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | 'novo' | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [pending, start] = useTransition()
  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const abertos = useMemo(() => pedidos.filter(p => p.status !== 'entregue'), [pedidos])
  const entregues = useMemo(() => pedidos.filter(p => p.status === 'entregue'), [pedidos])
  const totalAbertos = arred(abertos.reduce((s, p) => s + p.total, 0))
  const aReceber = arred(pedidos.reduce((s, p) => s + pagamento(p).falta, 0))
  const estaSemana = abertos.filter(p => p.due_date && diasAte(p.due_date) <= 7)
  const atrasados = abertos.filter(p => p.due_date && diasAte(p.due_date) < 0)

  const clientes: Cliente[] = useMemo(
    () =>
      clientesBase
        .map(c => {
          const seus = pedidos.filter(p => p.customer_id === c.id)
          return {
            ...c,
            pedidos: seus.length,
            total: arred(seus.reduce((s, p) => s + p.total, 0)),
            ultimo: seus.reduce<string | null>((u, p) => (!u || p.created_at > u ? p.created_at : u), null),
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [clientesBase, pedidos]
  )

  const filtrada = clienteFiltro ? clientes.find(c => c.id === clienteFiltro) : null
  const visiveis = clienteFiltro ? pedidos.filter(p => p.customer_id === clienteFiltro) : aba === 'abertos' ? abertos : entregues

  function aoSalvar(p: Pedido) {
    setPedidos(l => ordenar(l.some(x => x.id === p.id) ? l.map(x => (x.id === p.id ? p : x)) : [...l, p]))
    if (p.cliente && !clientesBase.some(c => c.id === p.cliente!.id)) {
      setClientesBase(l => [...l, { id: p.cliente!.id, name: p.cliente!.name, whatsapp: p.cliente!.whatsapp }])
    } else if (p.cliente) {
      setClientesBase(l => l.map(c => (c.id === p.cliente!.id ? { ...c, whatsapp: p.cliente!.whatsapp ?? c.whatsapp } : c)))
    }
    setEditando(null)
    avisar('Pedido salvo.')
  }

  function mudar(p: Pedido, patch: { status?: StatusPedido; paid_amount?: number }, msg: string) {
    start(async () => {
      const r = await atualizarPedido(p.id, patch)
      if (r.error) { setErro(r.error); return }
      setPedidos(l =>
        l.map(x =>
          x.id === p.id
            ? { ...x, ...(patch.status ? { status: patch.status, delivered_at: r.delivered_at ?? null } : {}), ...(patch.paid_amount != null ? { paid_amount: patch.paid_amount } : {}) }
            : x
        )
      )
      setErro('')
      avisar(msg)
    })
  }

  function apagar(id: string) {
    start(async () => {
      const r = await excluirPedido(id)
      if (r.error) { setErro(r.error); return }
      setPedidos(l => l.filter(p => p.id !== id))
      setConfirmando(null)
      avisar('Pedido apagado.')
    })
  }

  function apagarCliente(id: string) {
    start(async () => {
      const r = await excluirCliente(id)
      if (r.error) { setErro(r.error); return }
      setClientesBase(l => l.filter(c => c.id !== id))
      setConfirmando(null)
      avisar('Cliente apagada.')
    })
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Ferramentas
        </Link>
        <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
          Pedidos e <span className="text-[#6699F3]">clientes</span>
        </h1>

        {!podeEditar && (
          <div className="rounded-xl bg-[#FEC649]/15 border border-[#FEC649]/60 px-4 py-3 text-sm flex items-start gap-3">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Seus pedidos continuam aqui.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Com o Handify Completo ativo você volta a anotar e atualizar.</p>
              {planLink && (
                <a href={planLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6699F3] underline mt-1 min-h-[36px]">
                  <Sparkles className="w-3.5 h-3.5" /> Renovar o Completo
                </a>
              )}
            </div>
          </div>
        )}

        {/* Resumo */}
        {pedidos.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-2xl border border-border/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Em aberto</p>
              <p className="font-black text-lg leading-tight mt-0.5">{abertos.length} pedido{abertos.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">= {reais(totalAbertos)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-border/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">A receber</p>
              <p className="font-black text-lg leading-tight mt-0.5">{reais(aReceber)}</p>
              <p className={cn('text-xs', atrasados.length ? 'text-red-600 font-semibold' : 'text-muted-foreground')}>
                {atrasados.length
                  ? `${atrasados.length} atrasado${atrasados.length !== 1 ? 's' : ''}`
                  : estaSemana.length
                    ? `${estaSemana.length} entrega${estaSemana.length !== 1 ? 's' : ''} até domingo`
                    : 'nada para esta semana'}
              </p>
            </div>
          </div>
        )}

        {podeEditar && editando !== 'novo' && (
          <button onClick={() => { setEditando('novo'); setErro('') }} className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[48px] hover:bg-[#5580d4] handify-transition">
            <Plus className="w-4 h-4" /> Novo pedido
          </button>
        )}

        {editando === 'novo' && (
          <PedidoForm clientes={clientes} produtos={catalogo} onCancel={() => setEditando(null)} onSaved={aoSalvar} />
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {/* Abas */}
        {!clienteFiltro && (
          <div className="flex border-b border-border/70">
            {([
              ['abertos', `Abertos${abertos.length ? ` ${abertos.length}` : ''}`],
              ['entregues', `Entregues${entregues.length ? ` ${entregues.length}` : ''}`],
              ['clientes', `Clientes${clientes.length ? ` ${clientes.length}` : ''}`],
            ] as [Aba, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setAba(k)}
                className={cn('flex-1 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors min-h-[44px]', aba === k ? 'border-[#6699F3] text-[#6699F3]' : 'border-transparent text-muted-foreground hover:text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {clienteFiltro && filtrada && (
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">Pedidos de {filtrada.name}</p>
            <button onClick={() => setClienteFiltro(null)} className="text-sm font-semibold text-[#6699F3] min-h-[44px]">Ver todos</button>
          </div>
        )}

        {/* Clientes */}
        {aba === 'clientes' && !clienteFiltro ? (
          clientes.length === 0 ? (
            <Vazio emoji="👩" titulo="Nenhuma cliente ainda" texto="Elas aparecem aqui conforme você anota pedidos." />
          ) : (
            <div className="space-y-2">
              {clientes.map(c => {
                const zap = linkWhats(c.whatsapp)
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-border/60 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[15px] leading-tight">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''} = {reais(c.total)}
                          {c.ultimo && <> — último em {new Date(c.ultimo).toLocaleDateString('pt-BR')}</>}
                        </p>
                      </div>
                      {zap && (
                        <a href={zap} target="_blank" rel="noopener noreferrer" aria-label={`Chamar ${c.name} no WhatsApp`} className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-[#72CF92]/15 text-[#2D2D2D] hover:bg-[#72CF92]/30">
                          <MessageCircle className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {c.pedidos > 0 && (
                        <button onClick={() => { setClienteFiltro(c.id); setErro('') }} className="flex-1 rounded-lg border border-border text-sm font-semibold min-h-[44px]">Ver pedidos</button>
                      )}
                      {podeEditar && c.pedidos === 0 && (
                        confirmando === c.id ? (
                          <>
                            <button onClick={() => apagarCliente(c.id)} disabled={pending} className="flex-1 rounded-lg bg-red-600 text-white text-sm font-semibold min-h-[44px] disabled:opacity-60">Apagar</button>
                            <button onClick={() => setConfirmando(null)} className="rounded-lg border border-border text-sm px-3 min-h-[44px]">Não</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmando(c.id)} aria-label={`Apagar ${c.name}`} className="w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : visiveis.length === 0 && editando !== 'novo' ? (
          aba === 'entregues' && !clienteFiltro ? (
            <Vazio emoji="📦" titulo="Nenhum pedido entregue ainda" texto="Quando entregar, toque em “Entregue” no pedido." />
          ) : (
            <Vazio emoji="🧾" titulo="Nenhum pedido em aberto" texto={pedidos.length ? 'Tudo entregue. Bom sinal!' : 'Anote o primeiro: quem pediu, o que e para quando.'} />
          )
        ) : (
          <div className="space-y-2">
            {visiveis.map(p => {
              const pz = prazo(p)
              const pg = pagamento(p)
              const zap = linkWhats(p.cliente?.whatsapp ?? null)
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-border/60 p-4 space-y-2">
                  {editando === p.id ? (
                    <PedidoForm pedido={p} clientes={clientes} produtos={catalogo} onCancel={() => setEditando(null)} onSaved={aoSalvar} />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-[15px] leading-tight">{p.cliente?.name ?? 'Cliente removida'}</p>
                          <p className={cn('text-xs mt-0.5 font-semibold', pz.tom === 'atrasado' ? 'text-red-600' : pz.tom === 'hoje' || pz.tom === 'perto' ? 'text-[#2D2D2D]' : 'text-muted-foreground font-normal')}>{pz.texto}</p>
                        </div>
                        <p className="font-black text-lg tabular-nums shrink-0">{reais(p.total)}</p>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-0.5">
                        {p.itens.map((i, k) => (
                          <li key={i.id ?? k} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">
                              {i.quantity}× {i.name}
                              {podeEditar && !i.catalog_item_id && !noCatalogo(i.name) && (
                                <button onClick={() => adicionarAoCatalogo(i.name, i.unit_price)} disabled={pending} className="ml-2 text-[11px] font-semibold text-[#6699F3] underline disabled:opacity-60">
                                  + catálogo
                                </button>
                              )}
                            </span>
                            <span className="tabular-nums shrink-0">{reais(i.quantity * i.unit_price)}</span>
                          </li>
                        ))}
                      </ul>
                      {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', p.status === 'entregue' ? 'bg-[#F5F5F0] text-muted-foreground' : p.status === 'pronto' ? 'bg-[#72CF92]/20 text-[#2D2D2D]' : 'bg-[#6699F3]/15 text-[#2D2D2D]')}>{STATUS[p.status]}</span>
                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', pg.pago ? 'bg-[#72CF92]/20 text-[#2D2D2D]' : 'bg-[#FEC649]/25 text-[#2D2D2D]')}>{pg.texto}</span>
                      </div>
                      {podeEditar && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {p.status === 'a_fazer' && (
                            <button onClick={() => mudar(p, { status: 'pronto' }, 'Marcado como pronto.')} disabled={pending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] disabled:opacity-60">
                              <PackageCheck className="w-4 h-4" /> Ficou pronto
                            </button>
                          )}
                          {p.status === 'pronto' && (
                            <button onClick={() => mudar(p, { status: 'entregue' }, 'Entregue!')} disabled={pending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] disabled:opacity-60">
                              <Truck className="w-4 h-4" /> Entregue
                            </button>
                          )}
                          {!pg.pago && p.total > 0 && (
                            <button onClick={() => mudar(p, { paid_amount: p.total }, 'Recebido. Pedido pago.')} disabled={pending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#6699F3] text-[#6699F3] text-sm font-semibold min-h-[44px] disabled:opacity-60">
                              <HandCoins className="w-4 h-4" /> Recebi tudo
                            </button>
                          )}
                          {zap && (
                            <a href={zap} target="_blank" rel="noopener noreferrer" aria-label={`Chamar ${p.cliente?.name} no WhatsApp`} className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#72CF92]/15 hover:bg-[#72CF92]/30">
                              <MessageCircle className="w-5 h-5" />
                            </a>
                          )}
                          <button onClick={() => { setEditando(p.id); setErro('') }} aria-label="Editar pedido" className="w-11 h-11 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {confirmando === p.id ? (
                            <>
                              <button onClick={() => apagar(p.id)} disabled={pending} className="rounded-lg bg-red-600 text-white text-sm font-semibold px-3 min-h-[44px] disabled:opacity-60">Apagar</button>
                              <button onClick={() => setConfirmando(null)} className="rounded-lg border border-border text-sm px-3 min-h-[44px]">Não</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmando(p.id)} aria-label="Apagar pedido" className="w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50">
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

function Vazio({ emoji, titulo, texto }: { emoji: string; titulo: string; texto: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border/60 p-8 text-center space-y-2">
      <p className="text-3xl">{emoji}</p>
      <p className="font-semibold">{titulo}</p>
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  )
}

type Linha = { key: number; catalog_item_id: string | null; name: string; qtd: string; preco: string }
let chave = 1
const novaLinha = (): Linha => ({ key: chave++, catalog_item_id: null, name: '', qtd: '1', preco: '' })

function PedidoForm({
  pedido,
  clientes,
  produtos,
  onCancel,
  onSaved,
}: {
  pedido?: Pedido
  clientes: Cliente[]
  produtos: ProdutoOpcao[]
  onCancel: () => void
  onSaved: (p: Pedido) => void
}) {
  const [nome, setNome] = useState(pedido?.cliente?.name ?? '')
  const [whats, setWhats] = useState(pedido?.cliente?.whatsapp ?? '')
  const [data, setData] = useState(pedido?.due_date ?? '')
  const [obs, setObs] = useState(pedido?.notes ?? '')
  const [recebido, setRecebido] = useState(pedido && pedido.paid_amount > 0 ? String(pedido.paid_amount).replace('.', ',') : '')
  const [status, setStatus] = useState<StatusPedido>(pedido?.status ?? 'a_fazer')
  const [itens, setItens] = useState<Linha[]>(
    pedido?.itens.length
      ? pedido.itens.map(i => ({ key: chave++, catalog_item_id: i.catalog_item_id, name: i.name, qtd: String(i.quantity), preco: String(i.unit_price).replace('.', ',') }))
      : [novaLinha()]
  )
  const [erro, setErro] = useState('')
  const [pending, start] = useTransition()

  const total = arred(itens.reduce((s, l) => s + inteiro(l.qtd) * n(l.preco), 0))

  function mudarNome(v: string) {
    setNome(v)
    const c = clientes.find(x => x.name.toLowerCase() === v.trim().toLowerCase())
    if (c && c.whatsapp && !whats) setWhats(c.whatsapp)
  }
  const editar = (key: number, patch: Partial<Linha>) => setItens(l => l.map(x => (x.key === key ? { ...x, ...patch } : x)))
  function escolherProduto(key: number, id: string) {
    const p = produtos.find(x => x.id === id)
    editar(key, p ? { catalog_item_id: p.id, name: p.name, preco: String(p.price).replace('.', ',') } : { catalog_item_id: null })
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        start(async () => {
          const r = await salvarPedido({
            id: pedido?.id,
            cliente: { name: nome, whatsapp: whats },
            status,
            due_date: data || null,
            paid_amount: n(recebido),
            notes: obs,
            itens: itens.map(l => ({ catalog_item_id: l.catalog_item_id, name: l.name, quantity: inteiro(l.qtd), unit_price: n(l.preco) })),
          })
          if (r.error || !r.pedido) { setErro(r.error ?? 'Não deu para salvar.'); return }
          onSaved(r.pedido)
        })
      }}
      className="space-y-3 rounded-xl bg-[#F5F5F0] p-3"
    >
      <p className="font-bold">{pedido ? 'Editar pedido' : 'Novo pedido'}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted-foreground col-span-2 sm:col-span-1">
          Quem pediu
          <input value={nome} onChange={e => mudarNome(e.target.value)} list="clientes-conhecidas" placeholder="Ex.: Ana" className={INPUT} maxLength={80} required />
          <datalist id="clientes-conhecidas">
            {clientes.map(c => <option key={c.id} value={c.name} />)}
          </datalist>
        </label>
        <label className="block text-xs font-medium text-muted-foreground col-span-2 sm:col-span-1">
          WhatsApp (opcional)
          <input value={whats} onChange={e => setWhats(e.target.value)} placeholder="(11) 99999-9999" className={INPUT} maxLength={30} inputMode="tel" />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Itens</p>
        {itens.map(l => (
          <div key={l.key} className="bg-white rounded-lg border border-border p-2 space-y-2">
            {produtos.length > 0 && (
              <select value={l.catalog_item_id ?? ''} onChange={e => escolherProduto(l.key, e.target.value)} aria-label="Produto do catálogo" className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm min-h-[44px]">
                <option value="">Digitar item</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.name} = {reais(p.price)}</option>)}
              </select>
            )}
            <input value={l.name} onChange={e => editar(l.key, { name: e.target.value, catalog_item_id: null })} placeholder="Ex.: Vela de lavanda 200 g" aria-label="Nome do item" className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm min-h-[44px]" maxLength={120} required />
            <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
              <label className="text-[11px] text-muted-foreground">Qtd
                <input value={l.qtd} onChange={e => editar(l.key, { qtd: e.target.value })} inputMode="numeric" min={1} className="mt-0.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm min-h-[44px]" required />
              </label>
              <label className="text-[11px] text-muted-foreground">Preço (R$)
                <input value={l.preco} onChange={e => editar(l.key, { preco: e.target.value })} inputMode="decimal" placeholder="0,00" className="mt-0.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm min-h-[44px]" required />
              </label>
              <button type="button" onClick={() => setItens(x => (x.length > 1 ? x.filter(y => y.key !== l.key) : x))} aria-label="Tirar item" disabled={itens.length === 1} className="self-end w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600 disabled:opacity-30">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setItens(x => [...x, novaLinha()])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6699F3] min-h-[44px]">
          <Plus className="w-4 h-4" /> Mais um item
        </button>
        <p className="text-sm font-bold text-right">Total = {reais(total)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted-foreground">
          Entregar em
          <input type="date" value={data} onChange={e => setData(e.target.value)} className={INPUT} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Já recebeu (R$)
          <input value={recebido} onChange={e => setRecebido(e.target.value)} inputMode="decimal" placeholder="0,00" className={INPUT} />
        </label>
      </div>
      {pedido && (
        <div className="flex gap-2">
          {(Object.keys(STATUS) as StatusPedido[]).map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={cn('flex-1 rounded-lg border text-sm font-semibold min-h-[44px]', status === s ? 'border-[#6699F3] bg-[#6699F3]/10 text-[#2D2D2D]' : 'border-border text-muted-foreground')}>
              {STATUS[s]}
            </button>
          ))}
        </div>
      )}
      <label className="block text-xs font-medium text-muted-foreground">
        Observação (opcional)
        <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: embalar para presente" className={INPUT} maxLength={500} />
      </label>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] disabled:opacity-60">
          <Check className="w-4 h-4" /> {pending ? 'Salvando…' : 'Salvar pedido'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 text-sm min-h-[44px]"><X className="w-4 h-4" /></button>
      </div>
    </form>
  )
}
