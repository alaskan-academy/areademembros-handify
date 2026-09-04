'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Sparkles, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { salvarReceita } from '@/lib/receitas/actions'
import type { WickRecommendation } from '@/lib/pavio/types'
import type { ToolState } from '@/lib/ferramentas/types'
import {
  calcularAroma,
  calcularCustoBase,
  precoParaMargem,
  lucroPorUnidade,
  avisoDeMargem,
  encontrarPavio,
  escalarLote,
  custoInsumo,
  TAXAS_AROMA,
  reais,
  numero,
  codigosNoFornecedor,
  type Insumo,
  type Embalagem,
  type RespostasPavio,
  type TipoAroma,
} from '@/lib/ferramentas/calc'

/**
 * "Minha receita" — as quatro calculadoras (Lucro, Essências, Pavio e Escala de
 * lote) como etapas de um caminho só, sobre a mesma peça. Ela digita a receita
 * uma vez; cada etapa continua abrindo sozinha por `?etapa=`.
 *
 * A matemática está em lib/ferramentas/calc.ts (testada). Aqui é só tela.
 * Etapas de aluna (Essências, Pavio) chegam trancadas quando ela não tem o
 * curso: mostram o caminho e deixam pular. Aprovado pela Jessica em 03/09.
 */

// ─── Tipos de formulário (strings: o que ela digita) ─────────────────────────
type Produto = 'sabonetes' | 'velas'
type InsumoForm = { id: string; nome: string; qtdComprada: string; unidade: string; precoCompra: string; qtdUsadaNoLote: string }
type EmbForm = InsumoForm & { escopo: 'unidade' | 'lote' }
type Intensidade = 'suave' | 'moderado' | 'intenso' | 'custom'

export type Receita = {
  produto: Produto
  nome: string
  unidades: string
  pesoPorUnidade: string
  insumos: InsumoForm[]
  embalagens: EmbForm[]
  outros: {
    horasTrabalho: string; valorHora: string; utilidades: string; frete: string
    marketing: string; perdaPct: string; canalPct: string; impostoPct: string
  }
  aroma: { tipo: TipoAroma | null; intensidade: Intensidade; customPct: string }
  pavio: RespostasPavio
  margem: number
}

export type EtapaId = 'produto' | 'ingredientes' | 'essencias' | 'pavio' | 'preco' | 'ficha'

export type AcessoEtapas = {
  essencias: { state: ToolState; libera: string[] }
  pavio: { state: ToolState; libera: string[] }
}

const RASCUNHO_KEY = 'handify_receita_rascunho'
const SALVAS_KEY = 'handify_receitas_salvas'

const uid = () => Math.random().toString(36).slice(2) + Date.now()
const novoInsumo = (nome = ''): InsumoForm => ({ id: uid(), nome, qtdComprada: '', unidade: 'g', precoCompra: '', qtdUsadaNoLote: '' })
const novaEmb = (): EmbForm => ({ id: uid(), nome: '', qtdComprada: '', unidade: 'un', precoCompra: '', qtdUsadaNoLote: '1', escopo: 'unidade' })
// Aceita vírgula; negativo vira zero — mão de obra "-1 h" tirava dinheiro do custo.
const n = (s: string) => Math.max(0, parseFloat(String(s).replace(',', '.')) || 0)

function receitaVazia(produto: Produto = 'sabonetes'): Receita {
  return {
    produto,
    nome: '',
    unidades: '',
    pesoPorUnidade: '',
    insumos: [novoInsumo(), novoInsumo()],
    embalagens: [novaEmb()],
    outros: { horasTrabalho: '', valorHora: '15', utilidades: '0', frete: '', marketing: '', perdaPct: '5', canalPct: '0', impostoPct: '0' },
    aroma: { tipo: null, intensidade: 'moderado', customPct: '' },
    pavio: { candleType: null, waxType: null, moldShape: null, diameterValue: null, fragranceMid: null, hasDye: null },
    margem: 40,
  }
}

const PRODUTO_INFO: Record<Produto, { icone: string; nome: string; singular: string; plural: string; peso: string; dicaInsumos: string; dicaEmb: string }> = {
  sabonetes: {
    icone: '🧼', nome: 'Sabonete', singular: 'sabonete', plural: 'sabonetes',
    peso: 'Peso de cada sabonete (g)',
    dicaInsumos: 'Base glicerinada, essência, corante, mica, vitamina E…',
    dicaEmb: 'Rótulo, papel crepom, saquinho, caixinha…',
  },
  velas: {
    icone: '🕯️', nome: 'Vela', singular: 'vela', plural: 'velas',
    peso: 'Cera por vela (g)',
    dicaInsumos: 'Cera, essência, pavio, corante, sustentador…',
    dicaEmb: 'Vidro, tampa, rótulo, caixinha…',
  },
}

// ─── Opções do pavio (as mesmas da calculadora) ──────────────────────────────
const CERAS_RECIPIENTE = [
  { value: 'soy', label: 'Cera de soja', desc: 'EcoSoya, Golden Wax, NatureCera…' },
  { value: 'paraffin', label: 'Parafina', desc: 'Parafina container ou vela' },
  { value: 'ecomix', label: 'Ecomix', desc: 'Blend de soja + parafina, o mais usado' },
  { value: 'coconut', label: 'Cera de coco', desc: 'Coconut Wax, Coco 83…' },
  { value: 'blend', label: 'Outro blend', desc: 'Mistura de ceras (não ecomix)' },
  { value: 'beeswax', label: 'Cera de abelha', desc: 'Cera de abelha pura' },
]
const CERAS_MOLDE = [
  { value: 'pillar_paraffin', label: 'Parafina de alta fusão', desc: 'Parafina dura para moldes' },
  { value: 'soy', label: 'Cera de soja para moldes', desc: 'Fórmula para velas sólidas' },
  { value: 'ecomix', label: 'Ecomix', desc: 'Também usado em moldes' },
  { value: 'blend', label: 'Blend para moldes', desc: 'Alto ponto de fusão' },
]
const FORMATOS = [
  { value: 'cylindrical', label: 'Cilíndrica', desc: 'Reta, tipo pilar' },
  { value: 'conical', label: 'Cônica', desc: 'Afunila para cima' },
  { value: 'shaped', label: 'Com formato', desc: 'Flor, bolo, figura…' },
]
const DIAM_RECIPIENTE = [
  { label: '4 – 6 cm', desc: 'Copo pequeno / lata 100–150 mL', value: 5 },
  { label: '6 – 8 cm', desc: 'Vidro 150–250 mL (o mais comum)', value: 7.5 },
  { label: '8 – 10 cm', desc: 'Pote 250–400 mL', value: 9.5 },
  { label: '10 – 12 cm', desc: 'Pote 400–600 mL', value: 11.5 },
  { label: '12 cm ou mais', desc: 'Pote grande / tigela', value: 14 },
]
const DIAM_MOLDE = [
  { label: '4 – 6 cm', desc: 'Vela fina / pequena', value: 5 },
  { label: '6 – 8 cm', desc: 'Vela média', value: 7.5 },
  { label: '8 – 10 cm', desc: 'Vela grande', value: 9.5 },
  { label: '10 cm ou mais', desc: 'Vela muito grande', value: 12 },
]
const FRAGRANCIAS = [
  { label: '0 – 4%', desc: 'Leve — sutil', mid: 2 },
  { label: '4 – 8%', desc: 'Médio — presente, agradável', mid: 6 },
  { label: '8 – 12%', desc: 'Forte — muito aromático', mid: 10 },
  { label: '12% ou mais', desc: 'Máximo', mid: 14 },
]
const CERA_LABEL: Record<string, string> = {
  soy: 'Cera de soja', paraffin: 'Parafina', ecomix: 'Ecomix', coconut: 'Cera de coco',
  blend: 'Blend', beeswax: 'Cera de abelha', pillar_paraffin: 'Parafina alta fusão',
}
const faixaFragrancia = (pct: number) => (pct < 4 ? 2 : pct < 8 ? 6 : pct < 12 ? 10 : 14)

// ─── Componente ──────────────────────────────────────────────────────────────
export default function MinhaReceita({
  acesso,
  recomendacoes,
  planLink,
  tier,
  etapaInicial,
  produtoInicial,
  produtoPadrao = 'sabonetes',
  receitaInicial = null,
  nova = false,
}: {
  acesso: AcessoEtapas
  recomendacoes: WickRecommendation[]
  planLink: string | null
  tier: 'visitante' | 'aluna' | 'completo' | 'admin'
  etapaInicial?: string
  produtoInicial?: string
  /** Produto do curso dela — só define por onde começa; os dois continuam abertos. */
  produtoPadrao?: Produto
  /** Receita guardada na conta, aberta a partir de Minhas receitas. */
  receitaInicial?: { id: string; data: Receita } | null
  /** Veio de "Nova receita": ignora o rascunho do aparelho. */
  nova?: boolean
}) {
  const [receita, setReceita] = useState<Receita>(
    () => receitaInicial?.data ?? receitaVazia(produtoInicial === 'velas' ? 'velas' : produtoInicial === 'sabonetes' ? 'sabonetes' : produtoPadrao)
  )
  // Id na conta: existe quando ela abriu uma guardada ou já guardou esta.
  const [receitaId, setReceitaId] = useState<string | null>(receitaInicial?.id ?? null)
  const [guardando, setGuardando] = useState(false)
  const [carregou, setCarregou] = useState(false)
  const [toast, setToast] = useState('')

  const etapas = useMemo<EtapaId[]>(
    () => (receita.produto === 'velas'
      ? ['produto', 'ingredientes', 'essencias', 'pavio', 'preco', 'ficha']
      : ['produto', 'ingredientes', 'essencias', 'preco', 'ficha']),
    [receita.produto]
  )
  const [etapa, setEtapa] = useState<EtapaId>(() =>
    (['produto', 'ingredientes', 'essencias', 'pavio', 'preco', 'ficha'] as string[]).includes(etapaInicial ?? '')
      ? (etapaInicial as EtapaId)
      : 'produto'
  )

  // Rascunho no aparelho: sobrevive a um refresh e à troca de etapa.
  useEffect(() => {
    // localStorage só existe depois de montar; ler no initializer daria
    // hidratação diferente do servidor. Roda uma vez, sem cascata.
    try {
      const salvo = localStorage.getItem(RASCUNHO_KEY)
      if (salvo && !produtoInicial && !receitaInicial && !nova) {
        const r = JSON.parse(salvo) as Receita
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (r && r.produto) setReceita(r)
      }
    } catch {}
    setCarregou(true)
  }, [produtoInicial, receitaInicial, nova])
  useEffect(() => {
    if (!carregou) return
    try { localStorage.setItem(RASCUNHO_KEY, JSON.stringify(receita)) } catch {}
  }, [receita, carregou])

  const set = (patch: Partial<Receita>) => setReceita(r => ({ ...r, ...patch }))
  const info = PRODUTO_INFO[receita.produto]
  const idx = etapas.indexOf(etapa)
  const irPara = (e: EtapaId) => { setEtapa(e); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const proxima = () => idx < etapas.length - 1 && irPara(etapas[idx + 1])
  const anterior = () => idx > 0 && irPara(etapas[idx - 1])
  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  // ── Cálculos (a partir do que ela digitou) ──
  const unidades = n(receita.unidades)
  const insumos: Insumo[] = receita.insumos.map(i => ({ nome: i.nome, qtdComprada: n(i.qtdComprada), precoCompra: n(i.precoCompra), qtdUsadaNoLote: n(i.qtdUsadaNoLote) }))
  const embalagens: Embalagem[] = receita.embalagens.map(e => ({ nome: e.nome, qtdComprada: n(e.qtdComprada), precoCompra: n(e.precoCompra), qtdUsadaNoLote: n(e.qtdUsadaNoLote), escopo: e.escopo }))
  const custo = calcularCustoBase({
    unidades,
    insumos,
    embalagens,
    outros: {
      horasTrabalho: n(receita.outros.horasTrabalho), valorHora: n(receita.outros.valorHora) || 15,
      utilidades: n(receita.outros.utilidades), frete: n(receita.outros.frete), marketing: n(receita.outros.marketing),
      perdaPct: n(receita.outros.perdaPct), canalPct: n(receita.outros.canalPct), impostoPct: n(receita.outros.impostoPct),
    },
  })
  const preco = precoParaMargem(custo, receita.margem)
  const lucro = lucroPorUnidade(custo, preco)
  const materiaPrimaLote = insumos.reduce((s, i) => s + custoInsumo(i), 0)

  const percentualAroma = receita.aroma.tipo
    ? receita.aroma.intensidade === 'custom'
      ? n(receita.aroma.customPct)
      : TAXAS_AROMA[receita.produto][receita.aroma.tipo][receita.aroma.intensidade]
    : 0
  const aroma = receita.aroma.tipo
    ? calcularAroma({ unidades, pesoPorUnidade: n(receita.pesoPorUnidade), tipo: receita.aroma.tipo, percentual: percentualAroma })
    : null

  const pavioRec = receita.produto === 'velas' ? encontrarPavio(recomendacoes, receita.pavio) : null

  const temDados = unidades > 0 && insumos.some(i => i.qtdUsadaNoLote > 0 && i.precoCompra > 0)

  // ── Salvar no aparelho ──
  function salvarNoAparelho() {
    try {
      const lista = JSON.parse(localStorage.getItem(SALVAS_KEY) || '[]') as (Receita & { salvaEm: string })[]
      lista.unshift({ ...receita, salvaEm: new Date().toISOString() })
      localStorage.setItem(SALVAS_KEY, JSON.stringify(lista.slice(0, 30)))
      avisar('Receita salva neste aparelho.')
    } catch { avisar('Não deu para salvar aqui. Tente de novo.') }
  }
  function novaReceita() {
    setReceita(receitaVazia(receita.produto))
    setReceitaId(null)
    irPara('produto')
  }

  // ── Guardar na conta (Handify Completo) ──
  async function guardarNaConta() {
    const nome = receita.nome.trim() || `${info.nome} sem nome`
    setGuardando(true)
    try {
      const r = await salvarReceita({
        id: receitaId ?? undefined,
        name: nome,
        product: receita.produto,
        units: Math.round(custo.unidades),
        unit_weight: n(receita.pesoPorUnidade) || null,
        cost_per_unit: temDados ? Math.round(custo.custoPorUnidade * 100) / 100 : null,
        price: temDados ? Math.round(preco * 100) / 100 : null,
        margin: receita.margem,
        aroma: aroma && aroma.gramas > 0
          ? `${receita.aroma.tipo === 'oleo' ? 'Óleo essencial' : 'Essência'} ${numero(aroma.ml, 1)} mL = ${numero(aroma.gramas, 1)} g = ${aroma.gotas} gotas`
          : null,
        wick: pavioRec ? `${codigosNoFornecedor(pavioRec.wick_primary, receita.pavio.waxType).indicados.join(' ou ') || pavioRec.wick_primary} (${pavioRec.wick_primary})` : null,
        data: receita,
      })
      if (r.error) { avisar(r.error); return }
      if (r.id) setReceitaId(r.id)
      avisar(receitaId ? 'Receita atualizada em Minhas receitas.' : 'Guardada em Minhas receitas.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        {/* Cabeçalho + progresso */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
            <ChevronLeft className="w-4 h-4" /> Ferramentas
          </Link>
          <span className="text-xs text-muted-foreground">
            {idx + 1} de {etapas.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white overflow-hidden" role="progressbar" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={etapas.length} aria-label="Etapas da receita">
          <div className="h-full rounded-full bg-[#6699F3] handify-transition" style={{ width: `${((idx + 1) / etapas.length) * 100}%` }} />
        </div>
        <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
          {receita.nome ? receita.nome : <>Minha <span className="text-[#6699F3]">receita</span></>}
        </h1>

        {/* Atalhos entre etapas */}
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
          {etapas.map((e, i) => (
            <button
              key={e}
              onClick={() => irPara(e)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border min-h-[36px]',
                e === etapa ? 'bg-[#6699F3] text-white border-[#6699F3]' : i < idx ? 'bg-white text-[#6699F3] border-[#6699F3]/40' : 'bg-white text-muted-foreground border-border'
              )}
            >
              {ROTULO_ETAPA[e]}
            </button>
          ))}
        </div>

        {/* ── Etapas ── */}
        {etapa === 'produto' && (
          <Cartao titulo="O que você vai fazer?">
            <div className="grid grid-cols-2 gap-2">
              {(['sabonetes', 'velas'] as Produto[]).map(p => (
                <button
                  key={p}
                  onClick={() => set({ produto: p })}
                  className={cn('rounded-xl border-2 p-4 text-left min-h-[44px]', receita.produto === p ? 'border-[#6699F3] bg-[#6699F3]/5' : 'border-border bg-white')}
                >
                  <div className="text-2xl">{PRODUTO_INFO[p].icone}</div>
                  <div className="font-bold text-sm mt-1">{PRODUTO_INFO[p].nome}</div>
                </button>
              ))}
            </div>
            <Campo rotulo={`Nome do ${info.singular}`}>
              <input value={receita.nome} onChange={e => set({ nome: e.target.value })} placeholder={`Ex.: ${info.nome} de lavanda`} className={INPUT} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo={`Quantos ${info.plural} por lote?`}>
                <input type="number" min={0} inputMode="decimal" value={receita.unidades} onChange={e => set({ unidades: e.target.value })} placeholder="Ex.: 20" className={INPUT} />
              </Campo>
              <Campo rotulo={info.peso}>
                <input type="number" min={0} inputMode="decimal" value={receita.pesoPorUnidade} onChange={e => set({ pesoPorUnidade: e.target.value })} placeholder="Ex.: 90" className={INPUT} />
              </Campo>
            </div>
            <Rodape onAvancar={() => { if (unidades <= 0) return avisar(`Diga quantos ${info.plural} por lote.`); proxima() }} />
          </Cartao>
        )}

        {etapa === 'ingredientes' && (
          <Cartao titulo="Ingredientes do lote" sub={info.dicaInsumos}>
            <div className="space-y-3">
              {receita.insumos.map((i, k) => (
                <LinhaInsumo
                  key={i.id}
                  item={i}
                  podeRemover={receita.insumos.length > 1}
                  onChange={p => set({ insumos: receita.insumos.map(x => (x.id === i.id ? { ...x, ...p } : x)) })}
                  onRemove={() => set({ insumos: receita.insumos.filter(x => x.id !== i.id) })}
                  custo={custoInsumo(insumos[k])}
                />
              ))}
              <button onClick={() => set({ insumos: [...receita.insumos, novoInsumo()] })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6699F3] min-h-[44px]">
                <Plus className="w-4 h-4" /> Adicionar ingrediente
              </button>
            </div>
            <div className="rounded-xl bg-[#F5F5F0] p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Matéria-prima do lote</span>
              <b className="tabular-nums">{reais(materiaPrimaLote)}</b>
            </div>
            <EscalarLote unidades={unidades} onEscalar={novas => {
              set({ unidades: String(novas), insumos: receita.insumos.map((i, k) => ({ ...i, qtdUsadaNoLote: String(Math.round(escalarLote(insumos, unidades, novas)[k].qtdUsadaNoLote * 100) / 100) })) })
              avisar(`Receita escalada para ${novas} ${info.plural}.`)
            }} />
            <Rodape onVoltar={anterior} onAvancar={proxima} />
          </Cartao>
        )}

        {etapa === 'essencias' && (
          acesso.essencias.state !== 'aberta' ? (
            <EtapaTrancada
              titulo="Quanto de essência?"
              estado={acesso.essencias.state}
              libera={acesso.essencias.libera}
              planLink={planLink}
              onVoltar={anterior}
              onPular={proxima}
            />
          ) : (
            <Cartao titulo="Quanto de essência?" sub={`Para ${unidades || '—'} ${info.plural} de ${receita.pesoPorUnidade || '—'} g`}>
              <div className="grid grid-cols-2 gap-2">
                {([['essencia', 'Essência', 'Sintética, a mais comum'], ['oleo', 'Óleo essencial', 'Natural, mais leve']] as const).map(([v, l, d]) => (
                  <button key={v} onClick={() => set({ aroma: { ...receita.aroma, tipo: v } })} className={cn('rounded-xl border-2 p-3 text-left min-h-[44px]', receita.aroma.tipo === v ? 'border-[#6699F3] bg-[#6699F3]/5' : 'border-border bg-white')}>
                    <div className="font-bold text-sm">{l}</div>
                    <div className="text-xs text-muted-foreground">{d}</div>
                  </button>
                ))}
              </div>
              {receita.aroma.tipo && (
                <div className="grid grid-cols-2 gap-2">
                  {(['suave', 'moderado', 'intenso', 'custom'] as Intensidade[]).map(i => (
                    <button key={i} onClick={() => set({ aroma: { ...receita.aroma, intensidade: i } })} className={cn('rounded-xl border-2 p-3 text-left min-h-[44px]', receita.aroma.intensidade === i ? 'border-[#6699F3] bg-[#6699F3]/5' : 'border-border bg-white')}>
                      <div className="font-bold text-sm capitalize">{i === 'custom' ? 'Eu sei o %' : i}</div>
                      <div className="text-xs text-muted-foreground">
                        {i === 'custom' ? 'Personalizado' : `${TAXAS_AROMA[receita.produto][receita.aroma.tipo!][i]}% do peso`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {receita.aroma.tipo && receita.aroma.intensidade === 'custom' && (
                <Campo rotulo="Percentual (%)">
                  <input type="number" min={0} inputMode="decimal" value={receita.aroma.customPct} onChange={e => set({ aroma: { ...receita.aroma, customPct: e.target.value } })} placeholder="Ex.: 2,5" className={INPUT} />
                </Campo>
              )}
              {aroma && aroma.gramas > 0 && (
                <div className="rounded-xl bg-[#F5F5F0] p-4 grid grid-cols-3 gap-2 text-center">
                  <Valor v={`${numero(aroma.ml, 1)} mL`} l="mililitros" />
                  <Valor v={`${numero(aroma.gramas, 1)} g`} l="gramas" />
                  <Valor v={String(aroma.gotas)} l="gotas" />
                  <p className="col-span-3 text-xs text-muted-foreground mt-1">
                    {percentualAroma}% de {numero(aroma.pesoLote, 0)} g de lote (20 gotas por mL)
                  </p>
                </div>
              )}
              <Rodape onVoltar={anterior} onAvancar={proxima} />
            </Cartao>
          )
        )}

        {etapa === 'pavio' && (
          acesso.pavio.state !== 'aberta' ? (
            <EtapaTrancada titulo="Qual pavio usar?" estado={acesso.pavio.state} libera={acesso.pavio.libera} planLink={planLink} onVoltar={anterior} onPular={proxima} />
          ) : (
            <EtapaPavio
              respostas={receita.pavio}
              sugestaoFragrancia={aroma ? faixaFragrancia(percentualAroma) : null}
              onChange={p => set({ pavio: { ...receita.pavio, ...p } })}
              rec={pavioRec}
              onVoltar={anterior}
              onAvancar={proxima}
            />
          )
        )}

        {etapa === 'preco' && (
          <Cartao titulo="Custo e preço">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Embalagens · {info.dicaEmb}</p>
            <div className="space-y-3">
              {receita.embalagens.map(e => (
                <LinhaEmbalagem
                  key={e.id}
                  item={e}
                  podeRemover={receita.embalagens.length > 1}
                  onChange={p => set({ embalagens: receita.embalagens.map(x => (x.id === e.id ? { ...x, ...p } : x)) })}
                  onRemove={() => set({ embalagens: receita.embalagens.filter(x => x.id !== e.id) })}
                />
              ))}
              <button onClick={() => set({ embalagens: [...receita.embalagens, novaEmb()] })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6699F3] min-h-[44px]">
                <Plus className="w-4 h-4" /> Adicionar embalagem
              </button>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Outros custos do lote</p>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Horas de trabalho"><input type="number" min={0} inputMode="decimal" value={receita.outros.horasTrabalho} onChange={e => set({ outros: { ...receita.outros, horasTrabalho: e.target.value } })} placeholder="Ex.: 2" className={INPUT} /></Campo>
              <Campo rotulo="Valor da sua hora (R$)"><input type="number" min={0} inputMode="decimal" value={receita.outros.valorHora} onChange={e => set({ outros: { ...receita.outros, valorHora: e.target.value } })} className={INPUT} /></Campo>
              <Campo rotulo="Luz, gás, água (R$)"><input type="number" min={0} inputMode="decimal" value={receita.outros.utilidades} onChange={e => set({ outros: { ...receita.outros, utilidades: e.target.value } })} className={INPUT} /></Campo>
              <Campo rotulo="Frete dos insumos (R$)"><input type="number" min={0} inputMode="decimal" value={receita.outros.frete} onChange={e => set({ outros: { ...receita.outros, frete: e.target.value } })} placeholder="0" className={INPUT} /></Campo>
              <Campo rotulo="Divulgação (R$)"><input type="number" min={0} inputMode="decimal" value={receita.outros.marketing} onChange={e => set({ outros: { ...receita.outros, marketing: e.target.value } })} placeholder="0" className={INPUT} /></Campo>
              <Campo rotulo="Perda de material (%)"><input type="number" min={0} inputMode="decimal" value={receita.outros.perdaPct} onChange={e => set({ outros: { ...receita.outros, perdaPct: e.target.value } })} className={INPUT} /></Campo>
              <Campo rotulo="Onde vende">
                <select value={receita.outros.canalPct} onChange={e => set({ outros: { ...receita.outros, canalPct: e.target.value } })} className={INPUT}>
                  <option value="0">Direto (WhatsApp, feira) — 0%</option>
                  <option value="10">Marketplace — 10%</option>
                  <option value="15">Marketplace — 15%</option>
                  <option value="20">Marketplace — 20%</option>
                </select>
              </Campo>
              <Campo rotulo="Imposto">
                <select value={receita.outros.impostoPct} onChange={e => set({ outros: { ...receita.outros, impostoPct: e.target.value } })} className={INPUT}>
                  <option value="0">Sem nota — 0%</option>
                  <option value="6">MEI aprox. — 6%</option>
                  <option value="10">Simples — 10%</option>
                </select>
              </Campo>
            </div>

            {temDados ? (
              <div className="rounded-xl bg-[#F5F5F0] p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Margem de lucro</span>
                  <b className="text-[#6699F3]">{receita.margem}%</b>
                </div>
                <input type="range" min={10} max={80} value={receita.margem} onChange={e => set({ margem: Number(e.target.value) })} className="w-full accent-[#6699F3]" aria-label="Margem de lucro" />
                <p className={cn('text-xs', avisoDeMargem(receita.margem).tom === 'bom' ? 'text-[#3d9e5a]' : avisoDeMargem(receita.margem).tom === 'atencao' ? 'text-amber-700' : 'text-red-700')}>
                  {avisoDeMargem(receita.margem).texto}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Valor v={reais(custo.custoPorUnidade)} l={`custo / ${info.singular}`} />
                  <Valor v={reais(preco)} l="preço de venda" destaque />
                  <Valor v={reais(lucro)} l={`lucro / ${info.singular}`} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  No lote de {custo.unidades}: {reais(preco * custo.unidades)} de venda e {reais(lucro * custo.unidades)} de lucro
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Preencha os ingredientes (quantidade e preço) para ver o custo e o preço.</p>
            )}
            <Rodape onVoltar={anterior} onAvancar={proxima} rotuloAvancar="Ver a ficha" />
          </Cartao>
        )}

        {etapa === 'ficha' && (
          <Cartao titulo={receita.nome || `${info.nome} sem nome`} sub={`${custo.unidades} ${info.plural} de ${receita.pesoPorUnidade || '—'} g cada`}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Valor v={reais(custo.custoPorUnidade)} l="custo" />
              <Valor v={reais(preco)} l="preço" destaque />
              <Valor v={reais(lucro)} l="lucro" />
            </div>
            <Detalhe rotulo="Margem" valor={`${receita.margem}%`} />
            <Detalhe rotulo="Matéria-prima do lote" valor={reais(materiaPrimaLote)} />
            {aroma && aroma.gramas > 0 && (
              <Detalhe rotulo={receita.aroma.tipo === 'oleo' ? 'Óleo essencial' : 'Essência'} valor={`${numero(aroma.ml, 1)} mL = ${numero(aroma.gramas, 1)} g = ${aroma.gotas} gotas (${percentualAroma}% do lote)`} />
            )}
            {receita.produto === 'velas' && pavioRec && (
              <Detalhe rotulo="Pavio" valor={(() => {
                const loja = codigosNoFornecedor(pavioRec.wick_primary, receita.pavio.waxType)
                const principal = loja.indicados.length ? `${loja.indicados.join(' ou ')} (${pavioRec.wick_primary})` : pavioRec.wick_primary
                const alts = (pavioRec.wick_alternatives ?? [])
                  .filter(a => {
                    const c = codigosNoFornecedor(a, receita.pavio.waxType)
                    return !c.indicados.length || c.indicados.join() !== loja.indicados.join()
                  })
                  .map(a => {
                    const c = codigosNoFornecedor(a, receita.pavio.waxType)
                    return c.indicados.length ? `${c.indicados.join(' ou ')} (${a})` : a
                  })
                return alts.length ? `${principal}. Alternativas: ${alts.join(', ')}` : principal
              })()} />
            )}
            <div className="text-xs text-muted-foreground">
              {receita.insumos.filter(i => i.nome).map(i => `${i.nome} ${i.qtdUsadaNoLote}${i.unidade}`).join(', ')}
            </div>

            <div className="grid gap-2 pt-2">
              <button onClick={salvarNoAparelho} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] hover:bg-[#5580d4] handify-transition">
                <Check className="w-4 h-4" /> Salvar neste aparelho
              </button>
              {tier === 'completo' || tier === 'admin' ? (
                <>
                  <button
                    onClick={guardarNaConta}
                    disabled={guardando}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[#6699F3] text-[#6699F3] text-sm font-semibold min-h-[44px] hover:bg-[#6699F3]/10 disabled:opacity-60 handify-transition"
                  >
                    <Sparkles className="w-4 h-4" /> {guardando ? 'Guardando…' : receitaId ? 'Atualizar em Minhas receitas' : 'Guardar na conta'}
                  </button>
                  {receitaId && (
                    <Link href="/ferramentas/minhas-receitas" className="text-center text-xs text-[#6699F3] font-semibold underline min-h-[36px] inline-flex items-center justify-center">
                      Ver Minhas receitas
                    </Link>
                  )}
                </>
              ) : (
                <a href={planLink ?? '/cursos'} target={planLink ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#6699F3] text-[#6699F3] text-sm font-semibold min-h-[44px]">
                  <Sparkles className="w-4 h-4" /> Guardar na conta — no Handify Completo
                </a>
              )}
              <button onClick={novaReceita} className="text-sm text-muted-foreground min-h-[44px]">Começar outra receita</button>
            </div>
            <Rodape onVoltar={anterior} />
          </Cartao>
        )}

        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#0F0F0F] text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

const ROTULO_ETAPA: Record<EtapaId, string> = {
  produto: 'Produto', ingredientes: 'Ingredientes', essencias: 'Essências', pavio: 'Pavio', preco: 'Custo e preço', ficha: 'Ficha',
}
const INPUT = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'

// ─── Peças ───────────────────────────────────────────────────────────────────
function Cartao({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-border/60 p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold leading-tight">{titulo}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {children}
    </section>
  )
}
function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground">{rotulo}{children}</label>
}
function Valor({ v, l, destaque }: { v: string; l: string; destaque?: boolean }) {
  return (
    <div className={cn('rounded-lg py-2 px-1', destaque && 'bg-[#6699F3] text-white')}>
      <div className={cn('text-base font-black tabular-nums leading-tight', !destaque && 'text-[#2D2D2D]')}>{v}</div>
      <div className={cn('text-[10px] mt-0.5', destaque ? 'text-white/80' : 'text-muted-foreground')}>{l}</div>
    </div>
  )
}
function Detalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm border-t border-border/50 pt-2">
      <span className="text-muted-foreground">{rotulo}</span>
      <b className="text-right tabular-nums">{valor}</b>
    </div>
  )
}
function Rodape({ onVoltar, onAvancar, rotuloAvancar = 'Continuar' }: { onVoltar?: () => void; onAvancar?: () => void; rotuloAvancar?: string }) {
  return (
    <div className="flex gap-2 pt-2">
      {onVoltar && (
        <button onClick={onVoltar} className="inline-flex items-center gap-1 rounded-lg border border-border px-4 text-sm font-semibold min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
      )}
      {onAvancar && (
        <button onClick={onAvancar} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] hover:bg-[#5580d4] handify-transition">
          {rotuloAvancar} <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function LinhaInsumo({ item, custo, podeRemover, onChange, onRemove }: { item: InsumoForm; custo: number; podeRemover: boolean; onChange: (p: Partial<InsumoForm>) => void; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-2">
      <div className="flex gap-2">
        <input value={item.nome} onChange={e => onChange({ nome: e.target.value })} placeholder="Ingrediente" className={cn(INPUT, 'mt-0 flex-1')} />
        {podeRemover && (
          <button onClick={onRemove} aria-label="Remover ingrediente" className="w-11 h-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="text-muted-foreground">Comprei
          <div className="flex gap-1 mt-1">
            <input type="number" min={0} inputMode="decimal" value={item.qtdComprada} onChange={e => onChange({ qtdComprada: e.target.value })} placeholder="1000" className={cn(INPUT, 'mt-0 px-2')} />
            <select value={item.unidade} onChange={e => onChange({ unidade: e.target.value })} className="rounded-lg border border-border bg-white px-1 text-xs min-h-[44px]">
              <option>g</option><option>kg</option><option>mL</option><option>L</option><option>un</option>
            </select>
          </div>
        </label>
        <label className="text-muted-foreground">Paguei (R$)
          <input type="number" min={0} inputMode="decimal" value={item.precoCompra} onChange={e => onChange({ precoCompra: e.target.value })} placeholder="30" className={cn(INPUT, 'px-2')} />
        </label>
        <label className="text-muted-foreground">Uso no lote
          <input type="number" min={0} inputMode="decimal" value={item.qtdUsadaNoLote} onChange={e => onChange({ qtdUsadaNoLote: e.target.value })} placeholder="1800" className={cn(INPUT, 'px-2')} />
        </label>
      </div>
      {custo > 0 && <p className="text-xs text-right text-muted-foreground">custa <b className="text-foreground tabular-nums">{reais(custo)}</b> no lote</p>}
    </div>
  )
}

function LinhaEmbalagem({ item, podeRemover, onChange, onRemove }: { item: EmbForm; podeRemover: boolean; onChange: (p: Partial<EmbForm>) => void; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-2">
      <div className="flex gap-2">
        <input value={item.nome} onChange={e => onChange({ nome: e.target.value })} placeholder="Embalagem" className={cn(INPUT, 'mt-0 flex-1')} />
        {podeRemover && (
          <button onClick={onRemove} aria-label="Remover embalagem" className="w-11 h-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="text-muted-foreground">Comprei (un)
          <input type="number" min={0} inputMode="decimal" value={item.qtdComprada} onChange={e => onChange({ qtdComprada: e.target.value })} placeholder="50" className={cn(INPUT, 'px-2')} />
        </label>
        <label className="text-muted-foreground">Paguei (R$)
          <input type="number" min={0} inputMode="decimal" value={item.precoCompra} onChange={e => onChange({ precoCompra: e.target.value })} placeholder="10" className={cn(INPUT, 'px-2')} />
        </label>
        <label className="text-muted-foreground">Uso
          <input type="number" min={0} inputMode="decimal" value={item.qtdUsadaNoLote} onChange={e => onChange({ qtdUsadaNoLote: e.target.value })} placeholder="1" className={cn(INPUT, 'px-2')} />
        </label>
      </div>
      <div className="flex gap-2 text-xs">
        {(['unidade', 'lote'] as const).map(s => (
          <button key={s} onClick={() => onChange({ escopo: s })} className={cn('flex-1 rounded-lg border px-2 min-h-[36px] font-semibold', item.escopo === s ? 'border-[#6699F3] text-[#6699F3] bg-[#6699F3]/5' : 'border-border text-muted-foreground')}>
            {s === 'unidade' ? 'por unidade' : 'por lote'}
          </button>
        ))}
      </div>
    </div>
  )
}

function EscalarLote({ unidades, onEscalar }: { unidades: number; onEscalar: (novas: number) => void }) {
  const [novas, setNovas] = useState('')
  return (
    <div className="rounded-xl border border-dashed border-border p-3">
      <p className="text-xs font-semibold text-muted-foreground mb-1">Quer fazer outra quantidade? A receita escala sozinha.</p>
      <div className="flex gap-2">
        <input type="number" min={0} inputMode="decimal" value={novas} onChange={e => setNovas(e.target.value)} placeholder={unidades ? `Ex.: ${unidades * 2}` : 'Ex.: 50'} className={cn(INPUT, 'mt-0 flex-1')} aria-label="Nova quantidade do lote" />
        <button onClick={() => { const v = n(novas); if (v > 0 && unidades > 0) { onEscalar(v); setNovas('') } }} className="rounded-lg border border-[#6699F3] text-[#6699F3] px-4 text-sm font-semibold min-h-[44px]">Escalar</button>
      </div>
    </div>
  )
}

function EtapaTrancada({ titulo, estado, libera, planLink, onVoltar, onPular }: { titulo: string; estado: ToolState; libera: string[]; planLink: string | null; onVoltar: () => void; onPular: () => void }) {
  const cats = libera.map(c => c.replace(/ Artesana(l|is)$/i, ''))
  const lista = cats.length <= 1 ? cats[0] ?? '' : `${cats.slice(0, -1).join(', ')} ou ${cats[cats.length - 1]}`
  const texto = estado === 'com_categoria' ? `Esta etapa abre com um curso de ${lista}` : estado === 'com_completo' ? 'Esta etapa faz parte do Handify Completo' : 'Esta etapa abre com o seu primeiro curso'
  return (
    <Cartao titulo={titulo}>
      <div className="rounded-xl bg-[#F5F5F0] p-4 flex items-start gap-3">
        <Lock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">{texto}.</p>
          <p className="text-muted-foreground text-xs mt-1">Você pode pular e voltar aqui depois — o resto da receita continua funcionando.</p>
        </div>
      </div>
      <div className="grid gap-2">
        {estado === 'com_completo' ? (
          <a href={planLink ?? '/cursos'} target={planLink ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px]">Desbloquear com o Completo</a>
        ) : (
          <Link href="/cursos" className="inline-flex items-center justify-center rounded-lg bg-[#72CF92] text-[#0F0F0F] text-sm font-semibold min-h-[44px]">Ver cursos</Link>
        )}
        {estado === 'com_categoria' && planLink && (
          <a href={planLink} target="_blank" rel="noopener noreferrer" className="text-center text-xs text-[#6699F3] font-semibold underline min-h-[36px] inline-flex items-center justify-center">ou abrir tudo com o Handify Completo</a>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onVoltar} className="inline-flex items-center gap-1 rounded-lg border border-border px-4 text-sm font-semibold min-h-[44px]"><ChevronLeft className="w-4 h-4" /> Voltar</button>
        <button onClick={onPular} className="flex-1 rounded-lg border border-border text-sm font-semibold min-h-[44px]">Pular esta etapa</button>
      </div>
    </Cartao>
  )
}

function OpcaoPavio({ ativo, onClick, titulo, desc }: { ativo: boolean; onClick: () => void; titulo: string; desc?: string }) {
  return (
    <button onClick={onClick} className={cn('rounded-xl border-2 p-3 text-left min-h-[44px]', ativo ? 'border-[#6699F3] bg-[#6699F3]/5' : 'border-border bg-white')}>
      <div className="font-bold text-sm">{titulo}</div>
      {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
    </button>
  )
}

function EtapaPavio({ respostas, sugestaoFragrancia, onChange, rec, onVoltar, onAvancar }: {
  respostas: RespostasPavio
  sugestaoFragrancia: number | null
  onChange: (p: Partial<RespostasPavio>) => void
  rec: WickRecommendation | null
  onVoltar: () => void
  onAvancar: () => void
}) {
  const r = respostas
  const ceras = r.candleType === 'mold' ? CERAS_MOLDE : CERAS_RECIPIENTE
  const diametros = r.candleType === 'mold' ? DIAM_MOLDE : DIAM_RECIPIENTE
  const completo = !!(r.candleType && r.waxType && r.diameterValue && r.fragranceMid !== null && (r.candleType === 'container' || r.moldShape))
  return (
    <Cartao titulo="Qual pavio usar?" sub="Responda e a recomendação aparece embaixo">
      <p className="text-xs font-semibold text-muted-foreground">Tipo de vela</p>
      <div className="grid grid-cols-2 gap-2">
        <OpcaoPavio ativo={r.candleType === 'container'} onClick={() => onChange({ candleType: 'container', waxType: null, moldShape: null, diameterValue: null })} titulo="Em recipiente" desc="Vidro, lata, pote" />
        <OpcaoPavio ativo={r.candleType === 'mold'} onClick={() => onChange({ candleType: 'mold', waxType: null, moldShape: null, diameterValue: null })} titulo="Em molde" desc="Pilar, formato" />
      </div>
      {r.candleType && (
        <>
          <p className="text-xs font-semibold text-muted-foreground">Cera</p>
          <div className="grid grid-cols-2 gap-2">
            {ceras.map(c => <OpcaoPavio key={c.value} ativo={r.waxType === c.value} onClick={() => onChange({ waxType: c.value })} titulo={c.label} desc={c.desc} />)}
          </div>
        </>
      )}
      {r.candleType === 'mold' && r.waxType && (
        <>
          <p className="text-xs font-semibold text-muted-foreground">Formato</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMATOS.map(f => <OpcaoPavio key={f.value} ativo={r.moldShape === f.value} onClick={() => onChange({ moldShape: f.value })} titulo={f.label} desc={f.desc} />)}
          </div>
        </>
      )}
      {r.waxType && (r.candleType === 'container' || r.moldShape) && (
        <>
          <p className="text-xs font-semibold text-muted-foreground">Diâmetro</p>
          <div className="grid grid-cols-2 gap-2">
            {diametros.map(d => <OpcaoPavio key={d.value} ativo={r.diameterValue === d.value} onClick={() => onChange({ diameterValue: d.value })} titulo={d.label} desc={d.desc} />)}
          </div>
        </>
      )}
      {r.diameterValue && (
        <>
          <p className="text-xs font-semibold text-muted-foreground">
            Fragrância {sugestaoFragrancia && r.fragranceMid === null && <button onClick={() => onChange({ fragranceMid: sugestaoFragrancia })} className="ml-2 text-[#6699F3] underline">usar a da etapa anterior</button>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FRAGRANCIAS.map(f => <OpcaoPavio key={f.mid} ativo={r.fragranceMid === f.mid} onClick={() => onChange({ fragranceMid: f.mid })} titulo={f.label} desc={f.desc} />)}
          </div>
          <p className="text-xs font-semibold text-muted-foreground">Tem corante?</p>
          <div className="grid grid-cols-2 gap-2">
            <OpcaoPavio ativo={r.hasDye === true} onClick={() => onChange({ hasDye: true })} titulo="Sim" />
            <OpcaoPavio ativo={r.hasDye === false} onClick={() => onChange({ hasDye: false })} titulo="Não" />
          </div>
        </>
      )}
      {completo && (
        rec ? (
          <div className="rounded-xl bg-[#F5F5F0] p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Pavio recomendado para {CERA_LABEL[r.waxType!] ?? r.waxType}</p>
            {(() => {
              const loja = codigosNoFornecedor(rec.wick_primary, r.waxType)
              const fila = (c: { indicados: string[]; outros: string[] }) =>
                [c.indicados.join(' ou '), c.outros.length ? `(se não achar: ${c.outros.join(' ou ')})` : ''].filter(Boolean).join(' ')
              return (
                <>
                  <p className="text-2xl font-black text-[#6699F3]">
                    {loja.indicados.length ? loja.indicados.join(' ou ') : rec.wick_primary}
                  </p>
                  {loja.indicados.length > 0 && (
                    <p className="text-sm">
                      É o pavio <b>{rec.wick_primary}</b>{loja.mm ? ` (${loja.mm} mm)` : ''}
                      {loja.outros.length > 0 && <> — se não achar, <b>{loja.outros.join(' ou ')}</b></>}
                    </p>
                  )}
                  {rec.wick_alternatives?.length > 0 && (
                    <div className="text-sm pt-1">
                      <p className="text-xs text-muted-foreground">Alternativas</p>
                      {rec.wick_alternatives.filter(alt => {
                        // Séries diferentes com o mesmo código na loja (LX 12 e CD 12
                        // são ambos A2025) repetiriam a mesma resposta.
                        const c = codigosNoFornecedor(alt, r.waxType)
                        return !c.indicados.length || c.indicados.join() !== loja.indicados.join()
                      }).map(alt => {
                        const c = codigosNoFornecedor(alt, r.waxType)
                        return (
                          <p key={alt}>
                            <b>{c.indicados.length ? fila(c) : alt}</b>
                            {c.indicados.length > 0 && <span className="text-muted-foreground"> = {alt}</span>}
                          </p>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pt-1">
                    Na loja, o pavio de algodão vem com código A ou B: <b>A</b> queima mais suave (soja, coco, ecomix), <b>B</b> queima mais forte (parafina). O número cresce com o tamanho do pote.
                  </p>
                </>
              )
            })()}
            {rec.notes && <p className="text-xs text-muted-foreground">{rec.notes}</p>}
            <p className="text-xs text-muted-foreground pt-1">Faça o teste de queima: a piscina de cera deve chegar até a borda em 2–3 h, sem fuligem.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-[#FEC649]/15 border border-[#FEC649]/60 p-3 text-sm">Ainda não temos recomendação para essa combinação. Tente a cera mais parecida — ou pergunte no fórum.</div>
        )
      )}
      <Rodape onVoltar={onVoltar} onAvancar={onAvancar} />
    </Cartao>
  )
}
