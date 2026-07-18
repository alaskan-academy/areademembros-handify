'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NicheRow } from '@/lib/fornecedores/types'

type Tool = { name: string; desc: string; href: string; icon: string; soon?: boolean }
type Tab = { key: string; label: string; icon: string; tools: Tool[] }

const NICHE_ICONS: Record<string, string> = {
  'velas-artesanais':  '🕯️',
  'saboaria-artesanal': '🧼',
  'aromaterapia':      '🌿',
  'embalagens':        '📦',
}

function nicheToTab(niche: NicheRow): Tab {
  const icon = NICHE_ICONS[niche.slug] ?? '🎨'
  return {
    key: niche.slug,
    label: niche.name,
    icon,
    tools: [
      {
        name: 'Calculadora de Lucro',
        desc: `Calcule o custo real e o preço ideal de venda para ${niche.name.toLowerCase()} — incluindo mão de obra, embalagem e impostos.`,
        href: `/ferramentas/calculadora-lucro/${niche.slug}`,
        icon: '🧮',
      },
      {
        name: 'Calculadora de Essências',
        desc: 'Descubra exatamente quanto de essência ou óleo essencial usar na sua receita — resultado em mL, gramas e gotas.',
        href: `/ferramentas/calculadora-essencias/${niche.slug}`,
        icon: '💧',
      },
      {
        name: `Fornecedores de ${niche.name}`,
        desc: `Lista curada de materiais e lojas para ${niche.name.toLowerCase()} artesanais.`,
        href: `/ferramentas/fornecedores?nicho=${niche.id}`,
        icon: '🏪',
      },
      {
        name: 'Calculadora de Receita',
        desc: 'Escale sua receita para diferentes tamanhos de lote automaticamente.',
        href: '#',
        icon: '📐',
        soon: true,
      },
    ],
  }
}

const COMING_SOON_TABS = [
  { label: 'Costura', icon: '✂️' },
  { label: 'Crochê', icon: '🧶' },
  { label: 'Pintura', icon: '🎨' },
]

export default function FerramentasHub({ niches }: { niches: NicheRow[] }) {
  const TABS: Tab[] = niches.map(nicheToTab)
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '')
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const tab = TABS.find(t => t.key === activeTab) ?? TABS[0] ?? { key: '', label: '', icon: '', tools: [] }

  const filteredTools = busca.trim()
    ? tab.tools.filter(t =>
        t.name.toLowerCase().includes(busca.trim().toLowerCase()) ||
        t.desc.toLowerCase().includes(busca.trim().toLowerCase())
      )
    : tab.tools

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

        {/* Seletor de artesanato — retrátil */}
        <div className="mb-5 space-y-2">
          {/* Botão que mostra a seleção atual */}
          <button
            onClick={() => setSelectorOpen(v => !v)}
            aria-expanded={selectorOpen}
            className={cn(
              'w-full flex items-center justify-between gap-3 bg-white rounded-2xl border-2 p-4 transition-colors',
              selectorOpen
                ? 'border-[#6699F3]'
                : 'border-[#6699F3]/40 hover:border-[#6699F3]'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#6699F3]/10 flex items-center justify-center text-2xl shrink-0">
                {tab.icon}
              </div>
              <div className="text-left min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-1">
                  Artesanato selecionado
                </p>
                <p className="font-black text-[#0F0F0F] text-base leading-none">{tab.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[#6699F3] shrink-0">
              <span className="text-sm font-semibold hidden sm:inline">Trocar</span>
              <ChevronDown className={cn('w-5 h-5 transition-transform', selectorOpen && 'rotate-180')} />
            </div>
          </button>

          {/* Painel retrátil com opções */}
          {selectorOpen && (
            <div className="bg-white rounded-2xl border border-border/70 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Escolha seu artesanato
              </p>
              <div className="grid grid-cols-2 gap-2">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setActiveTab(t.key); setSelectorOpen(false) }}
                    className={cn(
                      'flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all text-left',
                      activeTab === t.key
                        ? 'border-[#6699F3] bg-[#6699F3]/5 text-[#6699F3]'
                        : 'border-border/60 text-foreground/70 hover:border-[#6699F3]/50 hover:text-[#6699F3]'
                    )}
                  >
                    <span className="text-xl">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
                {COMING_SOON_TABS.map(t => (
                  <button
                    key={t.label}
                    disabled
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 border-border/30 font-bold text-sm text-gray-300 cursor-not-allowed"
                  >
                    <span className="text-xl opacity-40">{t.icon}</span>
                    <span className="truncate">{t.label}</span>
                    <span className="text-[8px] font-black bg-[#FEC649] text-[#0F0F0F] px-1 py-0.5 rounded-full leading-none ml-auto shrink-0">
                      BREVE
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Busca dentro da categoria */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={`Buscar em ${tab.label}...`}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 transition-shadow"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tool cards */}
        {filteredTools.length === 0 && busca && (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">Nenhuma ferramenta encontrada</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredTools.map(tool => (
            tool.soon ? (
              <div
                key={tool.name}
                className="bg-white rounded-2xl border border-border/60 opacity-60 overflow-hidden"
              >
                <div className="p-6">
                  <div className="text-3xl mb-3">{tool.icon}</div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-black text-[#2D2D2D] text-base">{tool.name}</h3>
                    <span className="text-[10px] font-black bg-[#FEC649] text-[#0F0F0F] px-2 py-1 rounded-full whitespace-nowrap shrink-0">
                      Em breve
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
                </div>
              </div>
            ) : (
              <Link
                key={tool.name}
                href={tool.href}
                className="group bg-white rounded-2xl border border-border/60 hover:border-[#6699F3]/50 hover:shadow-md transition-all overflow-hidden flex flex-col"
              >
                <div className="flex h-[3px]">
                  <span className="flex-1 bg-[#6699F3]" />
                  <span className="flex-1 bg-[#72CF92]" />
                  <span className="flex-1 bg-[#FEC649]" />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="text-3xl mb-3">{tool.icon}</div>
                  <h3 className="font-black text-[#2D2D2D] text-base mb-2 group-hover:text-[#6699F3] transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed flex-1">{tool.desc}</p>
                  <div className="mt-5 flex items-center gap-1.5 bg-[#6699F3] group-hover:bg-[#5288EF] text-white text-sm font-bold px-4 py-3 rounded-xl transition-colors justify-center">
                    Abrir ferramenta
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )
          ))}
        </div>

        {/* Info strip */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-2 sm:gap-6 mt-10 text-sm text-gray-500">
          {[
            { dot: '#6699F3', text: 'Gratuito para todas as alunas' },
            { dot: '#FEC649', text: 'Novas ferramentas em breve' },
          ].map(({ dot, text }) => (
            <div key={text} className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
