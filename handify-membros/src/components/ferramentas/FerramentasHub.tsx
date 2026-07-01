'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Store } from 'lucide-react'

type Tool = { name: string; desc: string; href: string; icon: string; soon?: boolean }
type Tab = { key: string; label: string; icon: string; tools: Tool[] }

const TABS: Tab[] = [
  {
    key: 'sabonetes',
    label: 'Sabonetes',
    icon: '🧼',
    tools: [
      {
        name: 'Calculadora de Lucro',
        desc: 'Calcule o custo real de cada sabonete e descubra o preço ideal de venda — incluindo mão de obra, embalagem e impostos.',
        href: '/ferramentas/calculadora-lucro/sabonetes',
        icon: '🧮',
      },
      {
        name: 'Calculadora de Essências',
        desc: 'Descubra exatamente quanto de essência ou óleo essencial adicionar na sua receita — resultado em mL, gramas e gotas.',
        href: '/ferramentas/calculadora-essencias/sabonetes',
        icon: '🧼',
      },
      {
        name: 'Calculadora de Receita',
        desc: 'Escale sua receita para diferentes tamanhos de lote automaticamente.',
        href: '#',
        icon: '📐',
        soon: true,
      },
    ],
  },
  {
    key: 'velas',
    label: 'Velas',
    icon: '🕯️',
    tools: [
      {
        name: 'Calculadora de Lucro',
        desc: 'Calcule o custo real de cada vela e descubra o preço ideal de venda — incluindo mão de obra, embalagem e impostos.',
        href: '/ferramentas/calculadora-lucro/velas',
        icon: '🧮',
      },
      {
        name: 'Calculadora de Essências',
        desc: 'Descubra exatamente quanto de essência ou óleo essencial usar na sua cera — resultado em mL, gramas e gotas.',
        href: '/ferramentas/calculadora-essencias/velas',
        icon: '🕯️',
      },
      {
        name: 'Calculadora de Receita',
        desc: 'Escale sua receita para diferentes tamanhos de lote automaticamente.',
        href: '#',
        icon: '📐',
        soon: true,
      },
    ],
  },
]

const COMING_SOON_TABS = [
  { label: 'Costura', icon: '✂️' },
  { label: 'Crochê', icon: '🧶' },
  { label: 'Pintura', icon: '🎨' },
]

type MainTab = 'calculadoras' | 'fornecedores'

export default function FerramentasHub() {
  const [mainTab, setMainTab] = useState<MainTab>('calculadoras')
  const [activeTab, setActiveTab] = useState('sabonetes')
  const tab = TABS.find(t => t.key === activeTab) ?? TABS[0]

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Hero */}
      <div className="bg-white border-b border-border/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-center">
          <p className="text-sm font-medium text-[#6699F3] uppercase tracking-wide mb-3">
            Ferramentas Gratuitas
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-[#0F0F0F]">
            Ferramentas para <span className="text-[#6699F3]">Artesãs</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Calculadoras, fornecedores e recursos para você precificar, planejar e crescer no artesanato.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main tabs: Calculadoras | Fornecedores */}
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-border/60 mb-6 w-fit">
          <button
            onClick={() => setMainTab('calculadoras')}
            className={`flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all whitespace-nowrap ${
              mainTab === 'calculadoras'
                ? 'bg-[#6699F3] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            🧮 Calculadoras
          </button>
          <Link
            href="/ferramentas/fornecedores"
            className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all whitespace-nowrap text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          >
            <Store className="w-4 h-4" />
            Fornecedores
          </Link>
        </div>

        {/* Calculadoras section */}
        {/* Product sub-tabs */}
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-border/60 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center justify-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === t.key
                  ? 'bg-[#6699F3] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
          {COMING_SOON_TABS.map(t => (
            <button
              key={t.label}
              disabled
              className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl text-gray-300 cursor-not-allowed whitespace-nowrap"
            >
              <span>{t.icon}</span>
              {t.label}
              <span className="text-[9px] font-black bg-[#FEC649] text-[#0F0F0F] px-1.5 py-0.5 rounded-full leading-none">EM BREVE</span>
            </button>
          ))}
        </div>

        {/* Tool cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tab.tools.map(tool => (
            <div
              key={tool.name}
              className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                tool.soon
                  ? 'border-border/60 opacity-60'
                  : 'border-border/60 hover:border-[#6699F3]/40 hover:shadow-md'
              }`}
            >
              {!tool.soon && (
                <div className="flex h-[3px]">
                  <span className="flex-1 bg-[#6699F3]" />
                  <span className="flex-1 bg-[#72CF92]" />
                  <span className="flex-1 bg-[#FEC649]" />
                </div>
              )}
              <div className="p-6">
                <div className="text-3xl mb-3">{tool.icon}</div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-black text-[#2D2D2D] text-base">{tool.name}</h3>
                  {tool.soon && (
                    <span className="text-[10px] font-black bg-[#FEC649] text-[#0F0F0F] px-2 py-1 rounded-full whitespace-nowrap shrink-0">
                      Em breve
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">{tool.desc}</p>
                {!tool.soon && (
                  <Link
                    href={tool.href}
                    className="inline-flex items-center gap-1.5 bg-[#6699F3] hover:bg-[#5288EF] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    Abrir ferramenta
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Info strip */}
        <div className="flex flex-wrap gap-6 justify-center mt-10 text-sm text-gray-500">
          {[
            { dot: '#6699F3', text: 'Gratuito para todas as alunas' },
            { dot: '#72CF92', text: 'Funciona offline (dados salvos no seu dispositivo)' },
            { dot: '#FEC649', text: 'Novas ferramentas em breve' },
          ].map(({ dot, text }) => (
            <div key={text} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
