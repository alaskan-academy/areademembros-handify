'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Pencil, FileDown, Lock, Sparkles, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reais } from '@/lib/ferramentas/calc'
import { salvarMarca, salvarProduto, excluirProduto, type Marca, type Produto, type ReceitaOpcao } from '@/lib/catalogo/actions'

/**
 * Catálogo e tabela de preços — os produtos dela, com a marca dela, num PDF
 * para mandar no WhatsApp. Produto pode nascer de uma receita guardada: o
 * custo vem de lá, e quando a receita muda, aparece o preço sugerido novo.
 * Sem plano ativo: vê tudo e gera o PDF, não edita ("nunca some, só congela").
 */

const INPUT = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'
const n = (s: string) => Math.max(0, parseFloat(String(s).replace(',', '.')) || 0)

export default function Catalogo({
  marca: marcaInicial,
  produtos: produtosIniciais,
  receitas,
  podeEditar,
  planLink,
}: {
  marca: Marca
  produtos: Produto[]
  receitas: ReceitaOpcao[]
  podeEditar: boolean
  planLink: string | null
}) {
  const [marca, setMarca] = useState<Marca>(marcaInicial)
  const [editandoMarca, setEditandoMarca] = useState(!marcaInicial.brand_name)
  const [produtos, setProdutos] = useState<Produto[]>(produtosIniciais)
  const [editando, setEditando] = useState<string | 'novo' | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [pending, start] = useTransition()
  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const ativos = produtos.filter(p => p.active).length

  function apagar(id: string) {
    start(async () => {
      const r = await excluirProduto(id)
      if (r.error) { setErro(r.error); return }
      setProdutos(l => l.filter(p => p.id !== id))
      setConfirmando(null)
      avisar('Produto apagado.')
    })
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Ferramentas
        </Link>
        <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
          Catálogo e <span className="text-[#6699F3]">preços</span>
        </h1>

        {!podeEditar && (
          <div className="rounded-xl bg-[#FEC649]/15 border border-[#FEC649]/60 px-4 py-3 text-sm flex items-start gap-3">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Seu catálogo continua aqui, e o PDF também.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Com o Handify Completo ativo você volta a editar.</p>
              {planLink && (
                <a href={planLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6699F3] underline mt-1 min-h-[36px]">
                  <Sparkles className="w-3.5 h-3.5" /> Renovar o Completo
                </a>
              )}
            </div>
          </div>
        )}

        {/* Marca */}
        <section className="bg-white rounded-2xl border border-border/60 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sua marca — vai no topo do PDF</p>
              {!editandoMarca && (
                <>
                  <p className="font-bold text-lg leading-tight mt-1">{marca.brand_name || 'Sem nome ainda'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[marca.tagline, marca.whatsapp && `WhatsApp ${marca.whatsapp}`, marca.instagram, marca.city].filter(Boolean).join(' — ') || 'Toque em editar para preencher'}
                  </p>
                </>
              )}
            </div>
            {podeEditar && !editandoMarca && (
              <button onClick={() => setEditandoMarca(true)} className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-[#6699F3] min-h-[44px] px-2">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            )}
          </div>
          {editandoMarca && podeEditar && (
            <MarcaForm
              marca={marca}
              onCancel={() => setEditandoMarca(false)}
              onSaved={m => { setMarca(m); setEditandoMarca(false); avisar('Marca salva.') }}
            />
          )}
        </section>

        {/* PDF */}
        <a
          href="/api/ferramentas/catalogo/pdf"
          target="_blank"
          rel="noopener noreferrer"
          className={cn('inline-flex items-center justify-center gap-2 w-full rounded-lg text-sm font-semibold min-h-[48px] handify-transition', ativos > 0 ? 'bg-[#6699F3] text-white hover:bg-[#5580d4]' : 'bg-muted text-muted-foreground pointer-events-none')}
        >
          <FileDown className="w-4 h-4" /> Gerar o PDF da tabela de preços
        </a>
        <p className="text-xs text-muted-foreground text-center -mt-2">
          {ativos > 0
            ? `${ativos} produto${ativos !== 1 ? 's' : ''} no PDF. Abre em outra aba — toque em compartilhar e mande no WhatsApp.`
            : 'Adicione um produto para gerar o PDF.'}
        </p>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {/* Produtos */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Produtos</h2>
          {podeEditar && editando !== 'novo' && (
            <button onClick={() => setEditando('novo')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6699F3] min-h-[44px]">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          )}
        </div>

        {editando === 'novo' && (
          <ProdutoForm
            receitas={receitas}
            onCancel={() => setEditando(null)}
            onSaved={p => { setProdutos(l => [...l, p]); setEditando(null); avisar('Produto adicionado.') }}
          />
        )}

        {produtos.length === 0 && editando !== 'novo' ? (
          <div className="bg-white rounded-2xl border border-border/60 p-8 text-center space-y-2">
            <p className="text-3xl">🏷️</p>
            <p className="font-semibold">Nenhum produto ainda</p>
            <p className="text-sm text-muted-foreground">Adicione a partir de uma receita guardada — o custo já vem — ou digite direto.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {produtos.map(p => (
              <div key={p.id} className={cn('bg-white rounded-2xl border border-border/60 p-4 space-y-2', !p.active && 'opacity-60')}>
                {editando === p.id ? (
                  <ProdutoForm
                    produto={p}
                    receitas={receitas}
                    onCancel={() => setEditando(null)}
                    onSaved={np => { setProdutos(l => l.map(x => (x.id === np.id ? np : x))); setEditando(null); avisar('Produto salvo.') }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[15px] leading-tight">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                        {!p.active && <p className="text-[11px] text-muted-foreground mt-0.5">Fora do PDF</p>}
                      </div>
                      <p className="font-black text-lg tabular-nums shrink-0">{reais(p.price)}</p>
                    </div>
                    {p.receita && (
                      <ReceitaInfo produto={p} podeEditar={podeEditar} onAplicar={preco => {
                        start(async () => {
                          const r = await salvarProduto({ id: p.id, recipe_id: p.recipe_id, name: p.name, description: p.description ?? '', price: preco, active: p.active })
                          if (r.error) { setErro(r.error); return }
                          setProdutos(l => l.map(x => (x.id === p.id ? { ...x, price: preco } : x)))
                          avisar('Preço atualizado pela receita.')
                        })
                      }} />
                    )}
                    {podeEditar && (
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => setEditando(p.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-semibold min-h-[44px]">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        {confirmando === p.id ? (
                          <>
                            <button onClick={() => apagar(p.id)} disabled={pending} className="rounded-lg bg-red-600 text-white text-sm font-semibold px-3 min-h-[44px] disabled:opacity-60">Apagar</button>
                            <button onClick={() => setConfirmando(null)} className="rounded-lg border border-border text-sm px-3 min-h-[44px]">Não</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmando(p.id)} aria-label={`Apagar ${p.name}`} className="w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#0F0F0F] text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">{toast}</div>
        )}
      </div>
    </div>
  )
}

/** Custo e preço sugerido da receita ligada — e o botão de aplicar quando divergem. */
function ReceitaInfo({ produto, podeEditar, onAplicar }: { produto: Produto; podeEditar: boolean; onAplicar: (preco: number) => void }) {
  const r = produto.receita!
  const sugerido = r.price != null ? Math.round(Number(r.price) * 100) / 100 : null
  const custo = r.cost_per_unit != null ? Number(r.cost_per_unit) : null
  const margem = custo != null && produto.price > 0 ? Math.round(((produto.price - custo) / produto.price) * 100) : null
  const diverge = sugerido != null && Math.abs(sugerido - produto.price) >= 0.01
  return (
    <div className="rounded-lg bg-[#F5F5F0] px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground">
        Da receita <b className="text-foreground">{r.name}</b>
        {custo != null && <> — custo {reais(custo)}</>}
        {margem != null && <> = margem de {margem}%</>}
      </p>
      {diverge && (
        <p className="flex items-center justify-between gap-2">
          <span>A receita sugere <b>{reais(sugerido!)}</b></span>
          {podeEditar && (
            <button onClick={() => onAplicar(sugerido!)} className="text-[#6699F3] font-semibold underline min-h-[36px]">Aplicar</button>
          )}
        </p>
      )}
    </div>
  )
}

function MarcaForm({ marca, onCancel, onSaved }: { marca: Marca; onCancel: () => void; onSaved: (m: Marca) => void }) {
  const [f, setF] = useState<Marca>(marca)
  const [erro, setErro] = useState('')
  const [pending, start] = useTransition()
  const campo = (k: keyof Marca) => ({ value: f[k] ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) })
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        start(async () => {
          const r = await salvarMarca({ brand_name: f.brand_name, tagline: f.tagline ?? '', whatsapp: f.whatsapp ?? '', instagram: f.instagram ?? '', city: f.city ?? '' })
          if (r.error) { setErro(r.error); return }
          onSaved(f)
        })
      }}
      className="space-y-3"
    >
      <label className="block text-xs font-medium text-muted-foreground">Nome da marca<input {...campo('brand_name')} placeholder="Ex.: Ateliê da Maria" className={INPUT} maxLength={60} /></label>
      <label className="block text-xs font-medium text-muted-foreground">Uma frase (opcional)<input {...campo('tagline')} placeholder="Ex.: Velas e sabonetes feitos à mão" className={INPUT} maxLength={120} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted-foreground">WhatsApp<input {...campo('whatsapp')} placeholder="(11) 99999-9999" className={INPUT} maxLength={30} inputMode="tel" /></label>
        <label className="block text-xs font-medium text-muted-foreground">Instagram<input {...campo('instagram')} placeholder="@suamarca" className={INPUT} maxLength={60} /></label>
      </div>
      <label className="block text-xs font-medium text-muted-foreground">Cidade<input {...campo('city')} placeholder="Ex.: Curitiba, PR" className={INPUT} maxLength={60} /></label>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] disabled:opacity-60"><Check className="w-4 h-4" /> {pending ? 'Salvando…' : 'Salvar marca'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 text-sm min-h-[44px]"><X className="w-4 h-4" /></button>
      </div>
    </form>
  )
}

function ProdutoForm({ produto, receitas, onCancel, onSaved }: { produto?: Produto; receitas: ReceitaOpcao[]; onCancel: () => void; onSaved: (p: Produto) => void }) {
  const [nome, setNome] = useState(produto?.name ?? '')
  const [desc, setDesc] = useState(produto?.description ?? '')
  const [preco, setPreco] = useState(produto ? String(produto.price).replace('.', ',') : '')
  const [receitaId, setReceitaId] = useState<string>(produto?.recipe_id ?? '')
  const [ativo, setAtivo] = useState(produto?.active ?? true)
  const [erro, setErro] = useState('')
  const [pending, start] = useTransition()

  function escolherReceita(id: string) {
    setReceitaId(id)
    const r = receitas.find(x => x.id === id)
    if (r) {
      if (!nome) setNome(r.name)
      if (r.price != null && !preco) setPreco(String(r.price).replace('.', ','))
    }
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        start(async () => {
          const r = await salvarProduto({ id: produto?.id, recipe_id: receitaId || null, name: nome, description: desc, price: n(preco), active: ativo })
          if (r.error) { setErro(r.error); return }
          const rec = receitas.find(x => x.id === receitaId)
          onSaved({
            id: r.id ?? produto!.id,
            recipe_id: receitaId || null,
            name: nome.trim(),
            description: desc.trim() || null,
            price: n(preco),
            active: ativo,
            position: produto?.position ?? 0,
            receita: rec ? { name: rec.name, cost_per_unit: rec.cost_per_unit, price: rec.price } : null,
          })
        })
      }}
      className="space-y-3 rounded-xl bg-[#F5F5F0] p-3"
    >
      {receitas.length > 0 && (
        <label className="block text-xs font-medium text-muted-foreground">
          A partir de uma receita guardada (opcional)
          <select value={receitaId} onChange={e => escolherReceita(e.target.value)} className={INPUT}>
            <option value="">— sem receita —</option>
            {receitas.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}{r.price != null ? ` — sugere ${reais(Number(r.price))}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-xs font-medium text-muted-foreground">Nome do produto<input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Vela de lavanda 200 g" className={INPUT} maxLength={80} required /></label>
      <label className="block text-xs font-medium text-muted-foreground">Descrição curta (opcional)<input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: cera de soja, 40 h de queima" className={INPUT} maxLength={200} /></label>
      <div className="grid grid-cols-2 gap-3 items-end">
        <label className="block text-xs font-medium text-muted-foreground">Preço (R$)<input value={preco} onChange={e => setPreco(e.target.value)} placeholder="Ex.: 24,50" className={INPUT} inputMode="decimal" required /></label>
        <label className="flex items-center gap-2 text-sm min-h-[44px]"><input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="w-4 h-4 accent-[#6699F3]" /> Entra no PDF</label>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] disabled:opacity-60"><Check className="w-4 h-4" /> {pending ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 text-sm min-h-[44px]"><X className="w-4 h-4" /></button>
      </div>
    </form>
  )
}
