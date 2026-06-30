'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EssenciasConfig = {
  produto: 'sabonetes' | 'velas'
  icon: string
  nome: string
  nomeSingular: string
  pesoLabel: string
  pesoPlaceholder: string
  pesoTooltip: string
  tipoAlerta: 'hidro' | 'lipo'
  dicaAdicionar: string
  rates: {
    essencia: Record<'suave' | 'moderado' | 'intenso', number>
    oleo: Record<'suave' | 'moderado' | 'intenso', number>
  }
}

type TipoEssencia = 'essencia' | 'oleo' | null
type Intensidade = 'suave' | 'moderado' | 'intenso' | 'custom'

// Densidades aproximadas (g/mL)
const DENSIDADE: Record<'essencia' | 'oleo', number> = { essencia: 1.0, oleo: 0.9 }
// Gotas por mL (conta-gotas padrão)
const GOTAS_POR_ML = 20

// ── Component ────────────────────────────────────────────────────────────────

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

  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6699F3] focus:ring-2 focus:ring-[#6699F3]/20 bg-white'

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
          <div className="text-3xl mb-2">🧴</div>
          <h1 className="text-2xl font-black">Calculadora de <span className="text-[#72CF92]">Essências</span></h1>
          <p className="text-sm text-gray-400 mt-2">{config.nome} — descubra exatamente quanto de essência adicionar na sua receita.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── 1. SEU LOTE ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 font-bold text-lg mb-1">
            <span>{config.icon}</span>Seu Lote
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Informe quantos {config.nomeSingular}s você vai fazer e o peso de cada um — o resultado aparece automaticamente.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Quantas unidades no lote?</label>
              <p className="text-xs text-gray-400 mb-2">Total de {config.nomeSingular}s que você vai produzir agora.</p>
              <input type="number" min={1} placeholder="Ex: 20" className={inputCls} value={unidades} onChange={e => setUnidades(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">{config.pesoLabel}</label>
              <p className="text-xs text-gray-400 mb-2">{config.pesoTooltip}</p>
              <div className="relative">
                <input type="number" min={1} placeholder={config.pesoPlaceholder} className={`${inputCls} pr-10`} value={pesoPorUnidade} onChange={e => setPesoPorUnidade(e.target.value)} />
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

        {/* ── 2. CARD EDUCATIVO: HIDRO vs LIPO ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 font-bold text-base mb-1">
            <span>📚</span>Qual tipo de essência comprar?
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Antes de escolher sua essência, entenda a diferença — usar o tipo errado pode arruinar o lote inteiro.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border-2 border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center gap-2 font-bold text-sm text-blue-700 mb-2">
                <span>💧</span>Hidrossolúvel
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Solúvel em água.</strong> Se mistura facilmente com bases aquosas como a glicerina. Fica transparente e bem integrado ao sabonete, sem manchas ou separação.
              </p>
              <div className="mt-2.5 text-[11px] font-semibold text-blue-700 bg-blue-100 rounded-lg px-2.5 py-1 inline-block">
                ✅ Ideal para sabonetes de glicerina
              </div>
            </div>

            <div className="rounded-xl border-2 border-amber-100 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-700 mb-2">
                <span>🫒</span>Lipossolúvel
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Solúvel em gordura e óleo.</strong> Se mistura com ceras, manteigas e óleos. É o único que funciona em velas — a cera é base oleosa e repele qualquer coisa aquosa.
              </p>
              <div className="mt-2.5 text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-lg px-2.5 py-1 inline-block">
                ✅ Obrigatório para velas artesanais
              </div>
            </div>
          </div>

          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>Usar o tipo errado pode fazer o aroma não incorporar, causar manchas brancas no sabonete ou <strong>crepitação e risco de segurança em velas</strong>. Sempre confirme na embalagem antes de comprar.</span>
          </div>
        </div>

        {/* ── 3. ALERTA FIXO DO PRODUTO ── */}
        {config.tipoAlerta === 'hidro' ? (
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">💧</span>
              <div>
                <div className="font-black text-blue-800 mb-1.5">Para base glicerinada: use HIDROSSOLÚVEL</div>
                <p className="text-sm text-blue-700 leading-relaxed">
                  A base glicerinada é predominantemente aquosa. Essência lipossolúvel não se mistura com ela — fica em gotículas visíveis e pode criar pontos brancos ou uma névoa leitosa no sabonete pronto. Procure na embalagem a palavra <strong>&quot;hidrossolúvel&quot;</strong> ou <strong>&quot;water soluble&quot;</strong> antes de usar.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🫒</span>
              <div>
                <div className="font-black text-amber-800 mb-1.5">Para velas: use LIPOSSOLÚVEL</div>
                <p className="text-sm text-amber-700 leading-relaxed">
                  A cera (soja, parafina, coco) é 100% base oleosa. Essência hidrossolúvel não se dissolve na cera — pode ficar em camadas, fazer a vela crepitar durante a queima e <strong>representar risco de incêndio</strong>. Procure na embalagem a palavra <strong>&quot;lipossolúvel&quot;</strong> ou <strong>&quot;oil soluble&quot;</strong> antes de comprar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. TIPO DE ESSÊNCIA ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 font-bold text-lg mb-1">
            <span>🧪</span>Tipo de Essência
          </div>
          <p className="text-sm text-gray-500 mb-4">Escolha o que você vai usar. Cada um tem uma taxa de uso diferente na receita.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipoEssencia('essencia')}
              className={`rounded-xl border-2 p-4 text-left transition-all ${tipoEssencia === 'essencia' ? 'border-[#6699F3] bg-[#EEF3FD]' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-black text-sm mb-1.5">🌸 Essência / Fragrância</div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Aroma sintético, mais econômico e muito concentrado. Disponível em dezenas de fragrâncias. A escolha mais comum para quem está começando.
              </p>
              {tipoEssencia === 'essencia' && <div className="mt-2 text-[11px] font-bold text-[#6699F3]">✓ Selecionada</div>}
            </button>

            <button
              type="button"
              onClick={() => setTipoEssencia('oleo')}
              className={`rounded-xl border-2 p-4 text-left transition-all ${tipoEssencia === 'oleo' ? 'border-[#6699F3] bg-[#EEF3FD]' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-black text-sm mb-1.5">🌿 Óleo Essencial</div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Extrato 100% natural da planta. Mais delicado e caro — requer dosagem menor. Ideal para linhas naturais ou veganas.
              </p>
              {tipoEssencia === 'oleo' && <div className="mt-2 text-[11px] font-bold text-[#6699F3]">✓ Selecionado</div>}
            </button>
          </div>

          {tipoEssencia === 'oleo' && (
            <div className="mt-3 flex gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
              <span className="shrink-0">🌿</span>
              <span>Óleos essenciais têm limites de segurança para uso na pele. As taxas sugeridas aqui já respeitam os intervalos recomendados para uso cosmético seguro.</span>
            </div>
          )}
        </div>

        {/* ── 5. INTENSIDADE ── */}
        {tipoEssencia && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 font-bold text-lg mb-1">
              <span>🎚️</span>Intensidade do Aroma
            </div>
            <p className="text-sm text-gray-500 mb-4">Escolha o quanto de cheiro você quer no seu {config.nomeSingular}.</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {([
                { key: 'suave' as const, emoji: '🌸', label: 'Suave', desc: 'Aroma discreto, bom para peles sensíveis' },
                { key: 'moderado' as const, emoji: '🌺', label: 'Moderado', desc: 'Equilíbrio ideal — o mais usado' },
                { key: 'intenso' as const, emoji: '💐', label: 'Intenso', desc: 'Aroma marcante, dura mais' },
                { key: 'custom' as const, emoji: '⚙️', label: 'Personalizado', desc: 'Eu sei o % que quero' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setIntensidade(opt.key)}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${intensidade === opt.key ? 'border-[#6699F3] bg-[#EEF3FD]' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="text-xl mb-1">{opt.emoji}</div>
                  <div className="text-xs font-black text-[#2D2D2D]">{opt.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</div>
                  {intensidade === opt.key && opt.key !== 'custom' && (
                    <div className="mt-1.5 text-[10px] font-bold text-[#6699F3]">
                      {config.rates[tipoEssencia][opt.key]}%
                    </div>
                  )}
                </button>
              ))}
            </div>

            {intensidade === 'custom' && (
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Percentual que você quer usar</label>
                <p className="text-xs text-gray-400 mb-2">
                  Insira o % indicado pelo fabricante da sua essência.
                  {config.produto === 'sabonetes'
                    ? ' Para sabonetes de glicerina: 1–3% para essências e 0,5–1,5% para óleos essenciais.'
                    : ' Para velas: 5–10% para essências e 3–5% para óleos essenciais.'}
                </p>
                <div className="relative max-w-[160px]">
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
        )}

        {/* ── 6. RESULTADO (ao vivo) ── */}
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
                {totalLote.toLocaleString('pt-BR')} g no total · {percentual}% de {tipoEssencia === 'essencia' ? 'essência' : 'óleo essencial'} · intensidade {intensidade === 'custom' ? 'personalizada' : intensidade}
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
                * Gotas calculadas com base em 20 gotas por mL (conta-gotas padrão). Pode variar conforme o frasco da sua essência.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-gray-400">
            Preencha os campos acima para ver o resultado instantaneamente ↑
          </div>
        )}

      </div>
    </div>
  )
}
