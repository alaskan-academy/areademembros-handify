'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type MpItem = {
  id: string
  name: string
  qtyBought: string
  unit: string
  priceBought: string
  qtyUsed: string
}

type EmbItem = {
  id: string
  name: string
  qtyBought: string
  unit: string
  priceBought: string
  qtyUsed: string
  scope: 'unit' | 'lote'
}

type CalcResult = {
  batchQty: number
  channelRate: number
  taxFactor: number
  mpPerUnit: number
  wasteValue: number
  embPerUnit: number
  laborPerUnit: number
  fixedPerUnit: number
  marketingPerUnit: number
  baseCost: number
  productName: string
}

type SavedRecipe = {
  id: string
  name: string
  batchQty: number
  baseCost: number
  lastPrice: number
  lastMargin: number
  lastProfit: number
  savedAt: string
  raw: {
    productName: string; batchQty: string; unitWeight: string; salesChannel: string
    laborHours: string; laborRate: string; utilitiesSelect: string; utilitiesInput: string
    freightIn: string; taxSelect: string; taxRateInput: string; wasteRate: string
    marketing: string; margin: number; mpItems: MpItem[]; embItems: EmbItem[]
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

export type ProdutoConfig = {
  icon: string
  nome: string
  nomeSingular: string
  subtitulo: string
  namePlaceholder: string
  batchLabel: string
  batchPlaceholder: string
  unitLabel: string
  unitPlaceholder: string
  mpTips: string
  mpItemPlaceholder: string
  embItemPlaceholder: string
  embScopeLabel: string
  embTipsUnit: string
  embTipsLote: string
  defaultProductName: string
  storageKey: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return 'R$ ' + (isNaN(n) ? '0,00' : n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
}

function calcMpCost(item: MpItem): number {
  const b = parseFloat(item.qtyBought) || 0
  const p = parseFloat(item.priceBought) || 0
  const u = parseFloat(item.qtyUsed) || 0
  return b > 0 ? (u / b) * p : 0
}

function calcEmbCost(item: EmbItem, qty: number): number {
  const b = parseFloat(item.qtyBought) || 0
  const p = parseFloat(item.priceBought) || 0
  const u = parseFloat(item.qtyUsed) || 0
  if (b <= 0) return 0
  const cpi = p / b
  return item.scope === 'unit' ? cpi * u : (cpi * u) / qty
}

function uid() { return Math.random().toString(36).slice(2) + Date.now() }
function newMp(): MpItem { return { id: uid(), name: '', qtyBought: '', unit: 'g', priceBought: '', qtyUsed: '' } }
function newEmb(): EmbItem { return { id: uid(), name: '', qtyBought: '', unit: 'un', priceBought: '', qtyUsed: '1', scope: 'unit' } }

// ── Step bar ──────────────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  const steps = ['Produto', 'Matéria-Prima', 'Embalagens', 'Outros Custos', 'Resultado']
  return (
    <div className="flex items-center mb-6">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex-1 flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${done ? 'bg-[#6699F3] border-[#6699F3] text-white' : active ? 'bg-white border-[#6699F3] text-[#6699F3]' : 'bg-white border-gray-200 text-gray-400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-[10px] mt-1 font-medium hidden sm:block ${active ? 'text-[#6699F3]' : done ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${n < current ? 'bg-[#6699F3]' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── MP item row ───────────────────────────────────────────────────────────────

function MpRow({ item, placeholder, onChange, onRemove }: {
  item: MpItem; placeholder: string
  onChange: (f: keyof MpItem, v: string) => void; onRemove: () => void
}) {
  const cost = calcMpCost(item)
  return (
    <div className="bg-[#fafaf8] rounded-xl border border-gray-200 p-3 mb-3">
      <div className="flex gap-2 mb-2">
        <input type="text" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-[#6699F3]" placeholder={placeholder} value={item.name} onChange={e => onChange('name', e.target.value)} />
        <button type="button" onClick={onRemove} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-gray-200 text-xs font-bold shrink-0">✕</button>
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-medium mb-1">Comprei</span>
          <input type="number" className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6699F3]" placeholder="1000" min={0} value={item.qtyBought} onChange={e => onChange('qtyBought', e.target.value)} />
        </div>
        <select className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#6699F3]" value={item.unit} onChange={e => onChange('unit', e.target.value)}>
          <option>g</option><option>mL</option><option>un</option>
        </select>
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-medium mb-1">por R$</span>
          <input type="number" className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6699F3]" placeholder="40,00" min={0} step={0.01} value={item.priceBought} onChange={e => onChange('priceBought', e.target.value)} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-medium mb-1">Usei no lote</span>
          <input type="number" className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6699F3]" placeholder="300" min={0} value={item.qtyUsed} onChange={e => onChange('qtyUsed', e.target.value)} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-medium mb-1">= Custo</span>
          <div className={`text-sm font-bold px-2 py-1.5 rounded-lg ${cost > 0 ? 'text-[#6699F3] bg-blue-50' : 'text-gray-400 bg-gray-100'}`}>{cost > 0 ? fmt(cost) : 'R$ —'}</div>
        </div>
      </div>
    </div>
  )
}

// ── Emb item row ──────────────────────────────────────────────────────────────

function EmbRow({ item, placeholder, scopeLabel, batchQty, onChange, onRemove }: {
  item: EmbItem; placeholder: string; scopeLabel: string; batchQty: number
  onChange: (f: keyof EmbItem, v: string) => void; onRemove: () => void
}) {
  const cost = calcEmbCost(item, batchQty)
  const usedLabel = item.scope === 'unit' ? `Uso ${scopeLabel}` : 'Uso por lote'
  return (
    <div className="bg-[#fafaf8] rounded-xl border border-gray-200 p-3 mb-3">
      <div className="flex gap-2 mb-2">
        <input type="text" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-[#6699F3]" placeholder={placeholder} value={item.name} onChange={e => onChange('name', e.target.value)} />
        <select className="text-xs font-bold border border-[#EEF3FD] rounded-lg px-2 py-1.5 bg-[#EEF3FD] text-[#6699F3] focus:outline-none cursor-pointer shrink-0" value={item.scope} onChange={e => onChange('scope', e.target.value)}>
          <option value="unit">{scopeLabel}</option>
          <option value="lote">por lote inteiro</option>
        </select>
        <button type="button" onClick={onRemove} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-gray-200 text-xs font-bold shrink-0">✕</button>
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-medium mb-1">Comprei</span>
          <input type="number" className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6699F3]" placeholder="100" min={0} value={item.qtyBought} onChange={e => onChange('qtyBought', e.target.value)} />
        </div>
        <select className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#6699F3]" value={item.unit} onChange={e => onChange('unit', e.target.value)}>
          <option>un</option><option>m</option><option>cm</option><option>g</option>
        </select>
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-medium mb-1">por R$</span>
          <input type="number" className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6699F3]" placeholder="25,00" min={0} step={0.01} value={item.priceBought} onChange={e => onChange('priceBought', e.target.value)} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-medium mb-1">{usedLabel}</span>
          <input type="number" className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6699F3]" placeholder="1" min={0} value={item.qtyUsed} onChange={e => onChange('qtyUsed', e.target.value)} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-medium mb-1">= Custo</span>
          <div className={`text-sm font-bold px-2 py-1.5 rounded-lg ${cost > 0 ? 'text-[#6699F3] bg-blue-50' : 'text-gray-400 bg-gray-100'}`}>{cost > 0 ? fmt(cost) : 'R$ —'}</div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CalculadoraLucro({ config }: { config: ProdutoConfig }) {
  const [step, setStep] = useState(1)
  const [toast, setToast] = useState('')

  // Step 1
  const [productName, setProductName] = useState('')
  const [batchQty, setBatchQty] = useState('')
  const [unitWeight, setUnitWeight] = useState('')
  const [salesChannel, setSalesChannel] = useState('0')

  // Step 2
  const [mpItems, setMpItems] = useState<MpItem[]>(() => [newMp(), newMp()])

  // Step 3
  const [embItems, setEmbItems] = useState<EmbItem[]>(() => [newEmb()])

  // Step 4
  const [laborHours, setLaborHours] = useState('')
  const [laborRate, setLaborRate] = useState('15')
  const [utilitiesSelect, setUtilitiesSelect] = useState('3')
  const [utilitiesInput, setUtilitiesInput] = useState('')
  const [freightIn, setFreightIn] = useState('')
  const [taxSelect, setTaxSelect] = useState('0')
  const [taxRateInput, setTaxRateInput] = useState('')
  const [wasteRate, setWasteRate] = useState('5')
  const [marketing, setMarketing] = useState('0')

  // Step 5
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null)
  const [margin, setMargin] = useState(40)

  // Saved
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([])

  useEffect(() => { loadSavedRecipes() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function loadSavedRecipes() {
    try {
      const data = JSON.parse(localStorage.getItem(config.storageKey) || '{}')
      setSavedRecipes(Object.values(data).reverse() as SavedRecipe[])
    } catch { setSavedRecipes([]) }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const batchQtyNum = parseFloat(batchQty) || 1
  const mpTotal = mpItems.reduce((s, i) => s + calcMpCost(i), 0)
  const embTotal = embItems.reduce((s, i) => s + calcEmbCost(i, batchQtyNum), 0)

  function goToStep(n: number) {
    if (n === 2 && !validateStep1()) return
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function validateStep1(): boolean {
    if (!productName.trim()) { showToast('Por favor, dê um nome ao seu produto.'); return false }
    if (!batchQty || batchQtyNum < 1) { showToast('Informe quantas unidades por lote.'); return false }
    return true
  }

  function calculate() {
    const qty = batchQtyNum
    const lh = parseFloat(laborHours) || 0
    const lr = parseFloat(laborRate) || 15
    const utils = utilitiesSelect === 'custom' ? (parseFloat(utilitiesInput) || 0) : parseFloat(utilitiesSelect) || 0
    const freight = parseFloat(freightIn) || 0
    const tax = taxSelect === 'custom' ? (parseFloat(taxRateInput) || 0) : parseFloat(taxSelect) || 0
    const waste = parseFloat(wasteRate) || 5
    const mkt = parseFloat(marketing) || 0

    const mpPerUnit = mpTotal / qty
    const wasteValue = mpPerUnit * (waste / 100)
    const laborPerUnit = (lh * lr) / qty
    const fixedPerUnit = (utils + freight) / qty
    const marketingPerUnit = mkt / qty
    const baseCost = mpPerUnit + wasteValue + embTotal + laborPerUnit + fixedPerUnit + marketingPerUnit

    setCalcResult({
      batchQty: qty,
      channelRate: (parseFloat(salesChannel) || 0) / 100,
      taxFactor: tax / 100,
      mpPerUnit, wasteValue, embPerUnit: embTotal,
      laborPerUnit, fixedPerUnit, marketingPerUnit, baseCost,
      productName: productName.trim(),
    })
    setMargin(40)
    setStep(5)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function computePrice(d: CalcResult, m: number) {
    const ded = (m / 100) + d.channelRate + d.taxFactor
    if (ded >= 1) return d.baseCost * 10
    return d.baseCost / (1 - ded)
  }

  const price = calcResult ? computePrice(calcResult, margin) : 0
  const profit = calcResult ? price - calcResult.baseCost - price * calcResult.channelRate - price * calcResult.taxFactor : 0
  const batchProfit = profit * (calcResult?.batchQty || 0)
  const ecoPrice = calcResult ? computePrice(calcResult, 30) : 0
  const stdPrice = calcResult ? computePrice(calcResult, 50) : 0
  const prmPrice = calcResult ? computePrice(calcResult, 65) : 0

  function marginAlert(): { text: string; cls: string } | null {
    if (margin < 20) return { text: '⚠️ Margem muito baixa. Pode ter dificuldade de cobrir imprevistos.', cls: 'text-red-700 bg-red-50 border-red-200' }
    if (margin < 30) return { text: '⚠️ Margem no limite. O ideal é ficar acima de 30% para ter saúde financeira.', cls: 'text-amber-700 bg-amber-50 border-amber-200' }
    if (margin <= 60) return { text: '✅ Margem saudável! Esse é o intervalo recomendado para artesanato.', cls: 'text-green-700 bg-green-50 border-green-200' }
    if (margin <= 75) return { text: '⚠️ Margem alta. Pode funcionar no segmento premium — certifique-se de que o produto justifica o preço.', cls: 'text-amber-700 bg-amber-50 border-amber-200' }
    return { text: '⛔ Margem muito alta. Pode afastar clientes a menos que o produto seja muito exclusivo.', cls: 'text-red-700 bg-red-50 border-red-200' }
  }

  function saveRecipe() {
    if (!calcResult) { showToast('Calcule primeiro para salvar.'); return }
    try {
      const data = JSON.parse(localStorage.getItem(config.storageKey) || '{}')
      const id = 'recipe_' + Date.now()
      data[id] = {
        id, name: calcResult.productName,
        batchQty: calcResult.batchQty, baseCost: calcResult.baseCost,
        lastPrice: price, lastMargin: margin, lastProfit: profit,
        savedAt: new Date().toLocaleDateString('pt-BR'),
        raw: { productName, batchQty, unitWeight, salesChannel, laborHours, laborRate, utilitiesSelect, utilitiesInput, freightIn, taxSelect, taxRateInput, wasteRate, marketing, margin, mpItems, embItems },
      }
      localStorage.setItem(config.storageKey, JSON.stringify(data))
      loadSavedRecipes()
      showToast('✅ Receita salva!')
    } catch { showToast('Erro ao salvar.') }
  }

  function loadRecipe(r: SavedRecipe) {
    const d = r.raw
    setProductName(d.productName || ''); setBatchQty(d.batchQty || ''); setUnitWeight(d.unitWeight || '')
    setSalesChannel(d.salesChannel || '0'); setLaborHours(d.laborHours || ''); setLaborRate(d.laborRate || '15')
    setUtilitiesSelect(d.utilitiesSelect || '3'); setUtilitiesInput(d.utilitiesInput || ''); setFreightIn(d.freightIn || '')
    setTaxSelect(d.taxSelect || '0'); setTaxRateInput(d.taxRateInput || ''); setWasteRate(d.wasteRate || '5')
    setMarketing(d.marketing || '0'); setMargin(d.margin || 40)
    setMpItems(d.mpItems?.length ? d.mpItems : [newMp(), newMp()])
    setEmbItems(d.embItems?.length ? d.embItems : [newEmb()])
    setStep(1); showToast('Receita carregada! Revise e recalcule.')
  }

  function deleteRecipe(id: string) {
    try {
      const data = JSON.parse(localStorage.getItem(config.storageKey) || '{}')
      delete data[id]
      localStorage.setItem(config.storageKey, JSON.stringify(data))
      loadSavedRecipes(); showToast('Receita removida.')
    } catch {}
  }

  const alert = marginAlert()
  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6699F3] focus:ring-2 focus:ring-[#6699F3]/20 bg-white'
  const btnBack = 'text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors'
  const btnNext = 'bg-[#6699F3] hover:bg-[#5288EF] text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors'

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
          <h1 className="text-2xl font-black">Calculadora de <span className="text-[#72CF92]">Lucro Real</span></h1>
          <p className="text-sm text-gray-400 mt-2">{config.subtitulo}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <StepBar current={step} />

        {/* ── PASSO 1: PRODUTO ── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 font-bold text-lg mb-1"><span>{config.icon}</span>Informações do Produto</div>
            <p className="text-sm text-gray-500 mb-5">Vamos começar com o básico {config.nomeSingular === 'vela' ? 'da sua vela artesanal.' : 'do seu sabonete.'}</p>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">Nome do produto</label>
              <input type="text" className={inputCls} placeholder={config.namePlaceholder} maxLength={80} value={productName} onChange={e => setProductName(e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">{config.batchLabel}</label>
                <input type="number" className={inputCls} placeholder={config.batchPlaceholder} min={1} value={batchQty} onChange={e => setBatchQty(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">{config.unitLabel}</label>
                <input type="number" className={inputCls} placeholder={config.unitPlaceholder} min={1} value={unitWeight} onChange={e => setUnitWeight(e.target.value)} />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">Onde você vai vender?</label>
              <select className={inputCls} value={salesChannel} onChange={e => setSalesChannel(e.target.value)}>
                <option value="0">Venda direta (boca a boca, WhatsApp)</option>
                <option value="3">Marketplace online (Shopee, Mercado Livre)</option>
                <option value="5">Feiras e eventos</option>
                <option value="8">Loja física própria ou de terceiros</option>
                <option value="15">Plataforma de cursos / kit educacional</option>
                <option value="0">Ainda não sei</option>
              </select>
            </div>

            <div className="bg-[#EEF3FD] rounded-xl p-4 text-sm text-[#2D2D2D] mb-5">
              <strong>Dica:</strong> Se você vende em marketplace, ele desconta uma taxa do seu preço final. A calculadora já considera isso automaticamente.
            </div>

            <div className="flex justify-end">
              <button onClick={() => goToStep(2)} className={btnNext}>Próximo: Matéria-Prima →</button>
            </div>
          </div>
        )}

        {/* ── PASSO 2: MATÉRIA-PRIMA ── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 font-bold text-lg mb-1"><span>🧪</span>Matéria-Prima</div>
            <p className="text-sm text-gray-500 mb-5">Liste tudo que entra na receita do seu {config.nomeSingular}. Inclua até as quantidades menores.</p>

            {mpItems.map(item => (
              <MpRow key={item.id} item={item} placeholder={config.mpItemPlaceholder}
                onChange={(f, v) => setMpItems(prev => prev.map(i => i.id === item.id ? { ...i, [f]: v } : i))}
                onRemove={() => setMpItems(prev => prev.filter(i => i.id !== item.id))} />
            ))}

            <button type="button" onClick={() => setMpItems(prev => [...prev, newMp()])}
              className="w-full border-2 border-dashed border-[#6699F3]/40 hover:border-[#6699F3] text-[#6699F3] hover:bg-[#EEF3FD] rounded-xl py-2.5 text-sm font-semibold transition-colors mb-4">
              + Adicionar ingrediente
            </button>

            {mpTotal > 0 && (
              <div className="flex justify-between items-center bg-[#F5F5F0] rounded-xl px-4 py-3 mb-4 border border-gray-200">
                <span className="text-sm font-medium text-gray-600">Total matéria-prima (lote)</span>
                <span className="text-sm font-black text-[#6699F3]">{fmt(mpTotal)}</span>
              </div>
            )}

            <div className="bg-[#EEF3FD] rounded-xl p-4 text-sm text-[#2D2D2D] mb-5">
              <strong>Exemplos:</strong> {config.mpTips}
            </div>

            <div className="flex justify-between">
              <button onClick={() => goToStep(1)} className={btnBack}>← Voltar</button>
              <button onClick={() => goToStep(3)} className={btnNext}>Próximo: Embalagens →</button>
            </div>
          </div>
        )}

        {/* ── PASSO 3: EMBALAGENS ── */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 font-bold text-lg mb-1"><span>📦</span>Embalagens & Acabamento</div>
            <p className="text-sm text-gray-500 mb-5">Tudo o que você usa para embalar e apresentar o seu {config.nomeSingular}.</p>

            {embItems.map(item => (
              <EmbRow key={item.id} item={item} placeholder={config.embItemPlaceholder}
                scopeLabel={config.embScopeLabel} batchQty={batchQtyNum}
                onChange={(f, v) => setEmbItems(prev => prev.map(i => i.id === item.id ? { ...i, [f]: v } : i))}
                onRemove={() => setEmbItems(prev => prev.filter(i => i.id !== item.id))} />
            ))}

            <button type="button" onClick={() => setEmbItems(prev => [...prev, newEmb()])}
              className="w-full border-2 border-dashed border-[#6699F3]/40 hover:border-[#6699F3] text-[#6699F3] hover:bg-[#EEF3FD] rounded-xl py-2.5 text-sm font-semibold transition-colors mb-4">
              + Adicionar embalagem
            </button>

            {embTotal > 0 && (
              <div className="flex justify-between items-center bg-[#F5F5F0] rounded-xl px-4 py-3 mb-4 border border-gray-200">
                <span className="text-sm font-medium text-gray-600">Total embalagens (por unidade)</span>
                <span className="text-sm font-black text-[#6699F3]">{fmt(embTotal)}</span>
              </div>
            )}

            <div className="bg-[#EEF3FD] rounded-xl p-4 text-sm text-[#2D2D2D] mb-5">
              <strong>Por {config.nomeSingular}:</strong> {config.embTipsUnit}<br />
              <strong>Por lote inteiro:</strong> {config.embTipsLote}
            </div>

            <div className="flex justify-between">
              <button onClick={() => goToStep(2)} className={btnBack}>← Voltar</button>
              <button onClick={() => goToStep(4)} className={btnNext}>Próximo: Outros Custos →</button>
            </div>
          </div>
        )}

        {/* ── PASSO 4: OUTROS CUSTOS ── */}
        {step === 4 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 font-bold text-lg mb-1"><span>💡</span>Outros Custos</div>
            <p className="text-sm text-gray-500 mb-5">Esses custos são os que a maioria das artesãs esquece de incluir — e por isso vende no prejuízo sem saber.</p>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Tempo de produção <span className="font-normal text-gray-400">(h/lote)</span></label>
                <input type="number" className={inputCls} placeholder="Ex: 2" min={0} step={0.5} value={laborHours} onChange={e => setLaborHours(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Valor da sua hora <span className="font-normal text-gray-400">(R$/h)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">R$</span>
                  <input type="number" className={`${inputCls} pl-10`} placeholder="15,00" min={0} step={0.01} value={laborRate} onChange={e => setLaborRate(e.target.value)} />
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[['6.42', 'Sal. mín.'], ['15', 'Sugestão'], ['25', 'Profissional']].map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setLaborRate(val)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${laborRate === val ? 'bg-[#6699F3] border-[#6699F3] text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-[#6699F3] hover:text-[#6699F3]'}`}>
                      R${val} ({label})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#EEF3FD] rounded-xl p-4 text-sm text-[#2D2D2D] mb-5">
              <strong>Não sabe quanto cobrar?</strong> R$15,00 é uma boa sugestão. O importante é <em>não deixar em zero</em>, senão você trabalha de graça sem perceber.
            </div>

            <hr className="border-gray-100 mb-5" />

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Gás, luz, água <span className="font-normal text-gray-400">(por lote)</span></label>
                <select className={inputCls} value={utilitiesSelect} onChange={e => setUtilitiesSelect(e.target.value)}>
                  <option value="1.5">Pouco uso — menos de 1h (≈ R$1,50)</option>
                  <option value="3">Uso médio — 1 a 2h (≈ R$3,00)</option>
                  <option value="5">Bastante — 2 a 4h (≈ R$5,00)</option>
                  <option value="8">Muito uso — 4h+ (≈ R$8,00)</option>
                  <option value="custom">Prefiro digitar o valor</option>
                </select>
                {utilitiesSelect === 'custom' && (
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">R$</span>
                    <input type="number" className={`${inputCls} pl-10`} placeholder="Ex: 3,00" min={0} step={0.01} value={utilitiesInput} onChange={e => setUtilitiesInput(e.target.value)} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Frete das compras <span className="font-normal text-gray-400">(por lote)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">R$</span>
                  <input type="number" className={`${inputCls} pl-10`} placeholder="Ex: 5,00" min={0} step={0.01} value={freightIn} onChange={e => setFreightIn(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Imposto / taxa</label>
                <select className={inputCls} value={taxSelect} onChange={e => setTaxSelect(e.target.value)}>
                  <option value="0">Pessoa física / sem nota — 0%</option>
                  <option value="4.5">MEI — aprox. 4,5%</option>
                  <option value="6">Simples Nacional — aprox. 6%</option>
                  <option value="custom">Sei a minha taxa (digitar)</option>
                </select>
                {taxSelect === 'custom' && (
                  <div className="relative mt-2">
                    <input type="number" className={`${inputCls} pr-10`} placeholder="Ex: 6" min={0} max={30} step={0.1} value={taxRateInput} onChange={e => setTaxRateInput(e.target.value)} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">%</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Perdas e desperdícios <span className="font-normal text-gray-400">(%)</span></label>
                <div className="relative">
                  <input type="number" className={`${inputCls} pr-10`} placeholder="Ex: 5" min={0} max={30} step={0.5} value={wasteRate} onChange={e => setWasteRate(e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">%</span>
                </div>
              </div>
            </div>

            <hr className="border-gray-100 mb-4" />

            <div className="mb-5">
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">Verba de divulgação <span className="font-normal text-gray-400">(R$ por lote)</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">R$</span>
                <input type="number" className={`${inputCls} pl-10`} placeholder="Ex: 10,00" min={0} step={0.01} value={marketing} onChange={e => setMarketing(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => goToStep(3)} className={btnBack}>← Voltar</button>
              <button onClick={calculate} className="bg-[#72CF92] hover:bg-[#5dc07e] text-white font-black text-sm px-6 py-3 rounded-xl transition-colors">
                Calcular meu lucro ✓
              </button>
            </div>
          </div>
        )}

        {/* ── PASSO 5: RESULTADO ── */}
        {step === 5 && calcResult && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 font-bold text-lg mb-1"><span>💰</span>Seu Resultado</div>
              <p className="text-sm text-gray-500 mb-5">
                <strong>{calcResult.productName || config.defaultProductName}</strong> · Lote de {calcResult.batchQty} unidades
              </p>

              {/* Margin slider */}
              <div className="bg-[#F5F5F0] rounded-xl p-4 mb-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-gray-700">Qual margem de lucro você quer?</span>
                  <span className="bg-[#6699F3] text-white text-sm font-black px-3 py-1 rounded-full">{margin}%</span>
                </div>
                <input type="range" min={1} max={90} value={margin}
                  onChange={e => setMargin(parseInt(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, #6699F3 ${margin}%, #e5e7eb ${margin}%)` }}
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
                  <span>1%</span><span>30% — mínimo</span><span>60% — ideal</span><span>90%</span>
                </div>
                {alert && <div className={`mt-3 text-sm px-3 py-2 rounded-lg border ${alert.cls}`}>{alert.text}</div>}
              </div>

              {/* Results grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="col-span-2 bg-[#6699F3] text-white rounded-xl p-4 text-center">
                  <div className="text-xs font-semibold opacity-80 mb-1">Preço sugerido por unidade</div>
                  <div className="text-3xl font-black">{fmt(price)}</div>
                  <div className="text-xs opacity-70 mt-1">com {margin}% de margem</div>
                </div>
                <div className="bg-[#F5F5F0] rounded-xl p-3 text-center">
                  <div className="text-[11px] text-gray-500 mb-1">Custo por unidade</div>
                  <div className="text-xl font-black text-[#2D2D2D]">{fmt(calcResult.baseCost)}</div>
                  <div className="text-[10px] text-gray-400">antes da margem</div>
                </div>
                <div className={`rounded-xl p-3 text-center ${profit >= 0 ? 'bg-[#E8F7EE]' : 'bg-red-50'}`}>
                  <div className="text-[11px] text-gray-500 mb-1">Lucro por unidade</div>
                  <div className={`text-xl font-black ${profit >= 0 ? 'text-[#3aaa65]' : 'text-red-600'}`}>{fmt(profit)}</div>
                  <div className="text-[10px] text-gray-400">{fmt(profit * calcResult.batchQty)} no lote</div>
                </div>
                <div className="bg-[#F5F5F0] rounded-xl p-3 text-center">
                  <div className="text-[11px] text-gray-500 mb-1">Receita do lote</div>
                  <div className="text-xl font-black text-[#2D2D2D]">{fmt(price * calcResult.batchQty)}</div>
                  <div className="text-[10px] text-gray-400">vendendo {calcResult.batchQty} unid.</div>
                </div>
                <div className={`rounded-xl p-3 text-center ${batchProfit >= 0 ? 'bg-[#E8F7EE]' : 'bg-red-50'}`}>
                  <div className="text-[11px] text-gray-500 mb-1">Lucro total do lote</div>
                  <div className={`text-xl font-black ${batchProfit >= 0 ? 'text-[#3aaa65]' : 'text-red-600'}`}>{fmt(batchProfit)}</div>
                  <div className="text-[10px] text-gray-400">após todos os custos</div>
                </div>
              </div>

              {/* Price tiers */}
              <div className="mb-5">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Sugestões por posicionamento</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Econômico', p: ecoPrice, m: 30, cls: 'border-gray-200 text-gray-700' },
                    { label: '⭐ Padrão', p: stdPrice, m: 50, cls: 'border-[#6699F3] text-[#6699F3]' },
                    { label: 'Premium', p: prmPrice, m: 65, cls: 'border-[#FEC649] text-amber-700' },
                  ].map(t => (
                    <div key={t.label} className={`rounded-xl p-3 text-center border-2 ${t.cls}`}>
                      <div className="text-[11px] font-bold mb-1">{t.label}</div>
                      <div className="text-base font-black">{fmt(t.p)}</div>
                      <div className="text-[10px] text-gray-400">{t.m}% margem</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown */}
              <div className="bg-[#F5F5F0] rounded-xl p-4 mb-5">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Como seu custo se divide (por unidade)</div>
                {([
                  ['Matéria-prima', calcResult.mpPerUnit],
                  ['Embalagem', calcResult.embPerUnit],
                  ['Mão de obra', calcResult.laborPerUnit],
                  ['Custos fixos (luz, gás, frete)', calcResult.fixedPerUnit],
                  ['Perdas e desperdícios', calcResult.wasteValue],
                  ['Divulgação', calcResult.marketingPerUnit],
                ] as [string, number][]).map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-200 last:border-0">
                    <span className="text-sm text-gray-600">{label}</span>
                    <span className="text-sm font-bold text-[#2D2D2D]">{fmt(val)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 mt-1">
                  <span className="text-sm font-black text-[#2D2D2D]">Custo total por unidade</span>
                  <span className="text-sm font-black text-[#6699F3]">{fmt(calcResult.baseCost)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={saveRecipe} className="flex-1 text-sm font-semibold border border-gray-200 hover:border-[#6699F3] hover:text-[#6699F3] text-gray-600 px-4 py-2.5 rounded-xl transition-colors">
                  💾 Salvar receita
                </button>
                <button onClick={() => window.print()} className="flex-1 text-sm font-semibold border border-gray-200 hover:border-gray-400 text-gray-600 px-4 py-2.5 rounded-xl transition-colors">
                  🖨️ Imprimir
                </button>
                <button onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="flex-1 bg-[#6699F3] hover:bg-[#5288EF] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
                  + Nova calculadora
                </button>
              </div>
              <button onClick={() => goToStep(4)} className="mt-3 text-sm text-gray-500 hover:text-gray-700 font-medium">
                ← Ajustar custos
              </button>
            </div>
          </div>
        )}

        {/* ── RECEITAS SALVAS ── */}
        {savedRecipes.length > 0 && (
          <div className="mt-6">
            <div className="text-sm font-bold text-gray-500 mb-3">📁 Receitas salvas</div>
            <div className="space-y-2">
              {savedRecipes.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex justify-between items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#2D2D2D] truncate">{r.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Lote: {r.batchQty} un · Custo: {fmt(r.baseCost)}/un · Preço: {fmt(r.lastPrice)} · {r.savedAt}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => loadRecipe(r)} className="text-xs font-bold text-[#6699F3] border border-[#6699F3]/30 hover:bg-[#EEF3FD] px-3 py-1.5 rounded-lg transition-colors">Abrir</button>
                    <button onClick={() => deleteRecipe(r.id)} className="text-xs font-bold text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-2.5 py-1.5 rounded-lg transition-colors">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#0F0F0F] text-white text-sm font-medium px-5 py-3 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
