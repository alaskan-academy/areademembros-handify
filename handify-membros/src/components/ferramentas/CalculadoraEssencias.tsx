'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronDown } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EssenciasConfig = {
  produto: 'sabonetes' | 'velas'
  icon: string
  nome: string
  nomeSingular: string
  quantos: string          // "Quantos" | "Quantas" (concordância de gênero)
  pesoLabel: string
  pesoPlaceholder: string
  pesoTooltip: string
  tipoAlerta: 'hidro' | 'lipo'
  alertaLabel: string      // texto específico do produto no banner de alerta
  dicaAdicionar: string
  rates: {
    essencia: Record<'suave' | 'moderado' | 'intenso', number>
    oleo: Record<'suave' | 'moderado' | 'intenso', number>
  }
}

type TipoEssencia = 'essencia' | 'oleo' | null
type Intensidade = 'suave' | 'moderado' | 'intenso' | 'custom'

const DENSIDADE: Record<'essencia' | 'oleo', number> = { essencia: 1.0, oleo: 0.9 }
const GOTAS_POR_ML = 20

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-7 h-7 rounded-full bg-[#6699F3] text-white text-xs font-black flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="font-black text-[#2D2D2D] text-base">{label}</span>
    </div>
  )
}

function EduAccordion({ tipoAlerta }: { tipoAlerta: 'hidro' | 'lipo' }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>📚</span> Entender a diferença: Hidrossolúvel vs Lipossolúvel
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 bg-gray-50/50 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className={`rounded-xl border-2 p-3 ${tipoAlerta === 'hidro' ? 'border-blue-200 bg-blue-50/60' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-1.5 font-bold text-sm text-blue-700 mb-1.5">
                <span>💧</span>Hidrossolúvel
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Solúvel em água. Indicada para produtos de base aquosa: sabonete líquido, gel de banho, shampô, sal de banho.
              </p>
              <div className="mt-2 text-[11px] font-semibold text-blue-700">✅ Sabonete líquido, gel de banho, xampus</div>
            </div>
            <div className={`rounded-xl border-2 p-3 ${tipoAlerta === 'lipo' ? 'border-amber-200 bg-amber-50/60' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-1.5 font-bold text-sm text-amber-700 mb-1.5">
                <span>🫒</span>Lipossolúvel
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Solúvel em gordura. Indicada para base glicerinada sólida, velas, cremes e manteigas — incorpora sem separar.
              </p>
              <div className="mt-2 text-[11px] font-semibold text-amber-700">✅ Base glicerinada, velas, cremes, manteigas</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
            <span className="shrink-0">⚠️</span>
            <span>Usar o tipo errado pode fazer o aroma não incorporar ou <strong>criar risco de segurança em velas</strong>. Confirme na embalagem antes de comprar.</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CalculadoraEssencias({ config }: { config: EssenciasConfig }) {
  const [unidades, setUnidades] = useState('')
  const [pesoPorUnidade, setPesoPorUnidade] = useState('')
  const [tipoEssencia, setTipoEssencia] = useState<TipoEssencia>(null)
  const [intensidade, setIntensidade] = useState<Intensidade>('moderado')
  const [customPct, setCustomPct] = useState('')

  const totalLote = (parseFloat(unidades) || 0) * (parseFloat(pesoPorUnidade) || 0)

  const percentual = useMemo(() => {
    if (!tipoEssencia) return 0
    if (intensidade === 'custom') return parseFloat(customPct) || 0
    return config.rates[tipoEssencia][intensidade]
  }, [tipoEssencia, intensidade, customPct, config.rates])

  const gramas = totalLote > 0 && percentual > 0 ? totalLote * (percentual / 100) : 0
  const ml = tipoEssencia && gramas > 0 ? gramas / DENSIDADE[tipoEssencia] : 0
  const gotas = Math.round(ml * GOTAS_POR_ML)

  const showResult = totalLote > 0 && tipoEssencia !== null && percentual > 0

  const inputCls =
    'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6699F3] focus:ring-2 focus:ring-[#6699F3]/20 bg-white'

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <div className="bg-[#0F0F0F] text-white">
        <div className="flex h-[3px]">
          <span className="flex-1 bg-[#6699F3]" /><span className="flex-1 bg-[#72CF92]" /><span className="flex-1 bg-[#FEC649]" />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <Link href="/ferramentas" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white mb-4 transition-colors">
            <ChevronLeft className="w-3 h-3" />Ferramentas
          </Link>
          <div className="text-3xl mb-2">{config.icon}</div>
          <h1 className="text-2xl font-black">Calculadora de <span className="text-[#72CF92]">Essências</span></h1>
          <p className="text-sm text-gray-400 mt-2">
            {config.nome} — preencha os 3 passos e veja o resultado instantaneamente.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── PASSO 1: SEU LOTE ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <StepBadge n={1} label="Seu Lote" />
          <p className="text-sm text-gray-500 mb-5">
            {config.quantos} {config.nomeSingular}s você vai fazer e qual o peso de cada um.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Unidades no lote</label>
              <p className="text-xs text-gray-400 mb-2">{config.quantos} {config.nomeSingular}s você vai produzir agora.</p>
              <input
                type="number"
                min={1}
                placeholder="Ex: 20"
                className={inputCls}
                value={unidades}
                onChange={e => setUnidades(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">{config.pesoLabel}</label>
              <p className="text-xs text-gray-400 mb-2">{config.pesoTooltip}</p>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  placeholder={config.pesoPlaceholder}
                  className={`${inputCls} pr-10`}
                  value={pesoPorUnidade}
                  onChange={e => setPesoPorUnidade(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">g</span>
              </div>
            </div>
          </div>

          {totalLote > 0 && (
            <div className="mt-4 flex items-center justify-between bg-[#EEF3FD] rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-[#2D2D2D]">Peso total do lote</span>
              <span className="text-sm font-black text-[#6699F3]">{totalLote.toLocaleString('pt-BR')} g</span>
            </div>
          )}
        </div>

        {/* ── PASSO 2: TIPO DE ESSÊNCIA ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <StepBadge n={2} label="Qual tipo de essência você vai usar?" />

          {/* Alerta compacto — texto específico por produto */}
          {config.tipoAlerta === 'hidro' ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 mb-5 text-sm">
              <span className="shrink-0">💧</span>
              <span className="text-blue-800">{config.alertaLabel}, use <strong>Hidrossolúvel</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-5 text-sm">
              <span className="shrink-0">🫒</span>
              <span className="text-amber-800">{config.alertaLabel}, use <strong>Lipossolúvel</strong></span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipoEssencia('essencia')}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                tipoEssencia === 'essencia'
                  ? 'border-[#6699F3] bg-[#EEF3FD]'
                  : 'border-gray-200 bg-gray-50 hover:border-[#6699F3]/50 hover:bg-[#EEF3FD]/40'
              }`}
            >
              <div className="text-2xl mb-2">🌸</div>
              <div className="font-black text-sm text-[#2D2D2D] mb-1">Essência / Fragrância</div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Aroma sintético, econômico e muito concentrado. A escolha mais comum para quem está começando.
              </p>
              {tipoEssencia === 'essencia' && (
                <div className="mt-3 inline-block text-[11px] font-bold text-white bg-[#6699F3] px-2.5 py-1 rounded-full">
                  ✓ Selecionada
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTipoEssencia('oleo')}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                tipoEssencia === 'oleo'
                  ? 'border-[#6699F3] bg-[#EEF3FD]'
                  : 'border-gray-200 bg-gray-50 hover:border-[#6699F3]/50 hover:bg-[#EEF3FD]/40'
              }`}
            >
              <div className="text-2xl mb-2">🌿</div>
              <div className="font-black text-sm text-[#2D2D2D] mb-1">Óleo Essencial</div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Extrato 100% natural da planta. Mais delicado e caro — requer dosagem menor.
              </p>
              {tipoEssencia === 'oleo' && (
                <div className="mt-3 inline-block text-[11px] font-bold text-white bg-[#6699F3] px-2.5 py-1 rounded-full">
                  ✓ Selecionado
                </div>
              )}
            </button>
          </div>

          <EduAccordion tipoAlerta={config.tipoAlerta} />
        </div>

        {/* ── PASSO 3: INTENSIDADE ── */}
        <div
          className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-opacity ${
            tipoEssencia ? 'opacity-100' : 'opacity-40 pointer-events-none'
          }`}
        >
          <StepBadge n={3} label="Qual a intensidade do aroma?" />

          {!tipoEssencia && (
            <p className="text-sm text-gray-400 -mt-2 mb-4">← Selecione o tipo de essência no passo 2 para continuar.</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { key: 'suave' as const,    emoji: '🌸', label: 'Suave',         desc: 'Aroma discreto' },
              { key: 'moderado' as const, emoji: '🌺', label: 'Moderado',      desc: 'Equilíbrio ideal' },
              { key: 'intenso' as const,  emoji: '💐', label: 'Intenso',       desc: 'Aroma marcante' },
              { key: 'custom' as const,   emoji: '⚙️', label: 'Personalizado', desc: 'Eu sei o %' },
            ]).map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setIntensidade(opt.key)}
                disabled={!tipoEssencia}
                className={`rounded-xl border-2 p-3 text-center transition-all ${
                  intensidade === opt.key
                    ? 'border-[#6699F3] bg-[#EEF3FD]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-xl mb-1">{opt.emoji}</div>
                <div className="text-xs font-black text-[#2D2D2D]">{opt.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</div>
                {intensidade === opt.key && tipoEssencia && opt.key !== 'custom' && (
                  <div className="mt-1.5 text-[11px] font-bold text-[#6699F3]">
                    {config.rates[tipoEssencia][opt.key]}%
                  </div>
                )}
              </button>
            ))}
          </div>

          {intensidade === 'custom' && tipoEssencia && (
            <div className="mt-4">
              <label className="block text-sm font-semibold mb-1 text-gray-700">Percentual indicado pelo fabricante</label>
              <p className="text-xs text-gray-400 mb-2">
                {config.produto === 'sabonetes'
                  ? 'Para sabonetes: 1–3% para essências, 0,5–1,5% para óleos essenciais.'
                  : 'Para velas: 5–10% para essências, 3–5% para óleos essenciais.'}
              </p>
              <div className="relative w-36">
                <input
                  type="number"
                  min={0.1}
                  max={15}
                  step={0.1}
                  placeholder="Ex: 2"
                  className={`${inputCls} pr-10`}
                  value={customPct}
                  onChange={e => setCustomPct(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">%</span>
              </div>
            </div>
          )}
        </div>

        {/* ── RESULTADO ── */}
        {showResult ? (
          <div className="bg-[#0F0F0F] rounded-2xl overflow-hidden">
            <div className="flex h-[3px]">
              <span className="flex-1 bg-[#6699F3]" /><span className="flex-1 bg-[#72CF92]" /><span className="flex-1 bg-[#FEC649]" />
            </div>
            <div className="p-6">
              <div className="font-bold text-white text-base mb-1">
                Para o seu lote de {unidades} {config.nomeSingular}{parseFloat(unidades) !== 1 ? 's' : ''}
              </div>
              <p className="text-gray-400 text-xs mb-5">
                {totalLote.toLocaleString('pt-BR')} g no total · {percentual}% de{' '}
                {tipoEssencia === 'essencia' ? 'essência' : 'óleo essencial'} · intensidade{' '}
                {intensidade === 'custom' ? 'personalizada' : intensidade}
              </p>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">🧪</div>
                  <div className="text-2xl font-black text-white">
                    {ml.toFixed(1).replace('.', ',')}
                    <span className="text-sm font-medium"> mL</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">mililitros</div>
                </div>
                <div className="bg-[#6699F3] rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">⚖️</div>
                  <div className="text-2xl font-black text-white">
                    {gramas.toFixed(1).replace('.', ',')}
                    <span className="text-sm font-medium"> g</span>
                  </div>
                  <div className="text-xs text-blue-200 mt-1">gramas</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">💧</div>
                  <div className="text-2xl font-black text-white">
                    {gotas}
                    <span className="text-sm font-medium"> gts</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">gotas</div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-gray-300 mb-3">
                <div className="font-semibold text-white mb-1.5">📌 Como adicionar</div>
                {config.dicaAdicionar}
              </div>

              <p className="text-[10px] text-gray-500 text-center">
                * Gotas calculadas com base em 20 gotas por mL (conta-gotas padrão).
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-3 text-sm text-gray-400">
            Preencha os 3 passos acima para ver o resultado ↑
          </div>
        )}

      </div>
    </div>
  )
}
