'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolSection, ToolView, ViewerTools } from '@/lib/ferramentas/types'

/**
 * Área Ferramentas — a mesma tela para todos os tiers; o que muda é o estado de
 * cada ferramenta. Aprovado pela Jessica em 03/09 ("Ferramentas por Tier · v2").
 *
 * - "Seus artesanatos" vem dos cursos que ela tem, não de um seletor.
 * - Agrupado pelo que ela quer fazer: Calcular · Guardar · Fornecedores.
 * - Trancada nunca some: mostra o resultado borrado e o caminho. Nunca "bloqueado".
 * - Cabe na primeira tela do celular: título de uma linha, primeira ferramenta
 *   visível sem rolar.
 */

const SECOES: { key: ToolSection; label: string; hint: string }[] = [
  { key: 'calcular', label: 'Calcular', hint: 'Dá o número e você segue' },
  { key: 'guardar', label: 'Guardar', hint: 'Seu negócio fica salvo aqui' },
  { key: 'fornecedores', label: 'Fornecedores', hint: 'Onde comprar' },
]

const ICONE_NICHO: Record<string, string> = {
  'velas-artesanais': '🕯️',
  'saboaria-artesanal': '🧼',
}

const TIER_LABEL: Record<string, string> = {
  aluna: 'para alunas',
  completo: 'no Handify Completo',
}

export default function FerramentasHub({
  dados,
  bloqueada,
}: {
  dados: ViewerTools
  /** Slug de uma ferramenta que ela tentou abrir sem ter acesso. */
  bloqueada?: string
}) {
  const { tools, nichos, planLink, tier } = dados
  const ferramentaBloqueada = bloqueada ? tools.find(t => t.slug === bloqueada) : undefined
  const [secao, setSecao] = useState<ToolSection>(ferramentaBloqueada?.section ?? 'calcular')
  const [busca, setBusca] = useState('')

  const porSecao = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const filtrar = (t: ToolView) =>
      t.showInHub &&
      (!termo || t.name.toLowerCase().includes(termo) || (t.description ?? '').toLowerCase().includes(termo))
    return Object.fromEntries(
      SECOES.map(s => [s.key, tools.filter(t => t.section === s.key && filtrar(t))])
    ) as Record<ToolSection, ToolView[]>
  }, [tools, busca])

  const lista = porSecao[secao]

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-4">
        {/* Cabeçalho curto: a primeira ferramenta precisa aparecer sem rolar */}
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F0F0F] leading-none">
            Ferra<span className="text-[#6699F3]">mentas</span>
          </h1>
          {tier === 'completo' && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6699F3]">
              <Sparkles className="w-3.5 h-3.5" /> Completo
            </span>
          )}
        </div>

        {/* Seus artesanatos — derivado dos cursos; chip apagado é convite */}
        {nichos.length > 0 && (
          <div id="tour-ferramentas-nicho" className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span>Seus artesanatos:</span>
            {nichos.map(n => (
              <span
                key={n.id}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-xs font-semibold',
                  n.ativo
                    ? 'border-[#6699F3] text-[#6699F3] bg-[#6699F3]/10'
                    : 'border-border text-muted-foreground bg-white'
                )}
                title={n.ativo ? `Você tem curso de ${n.name}` : `Ainda sem curso de ${n.name}`}
              >
                <span>{ICONE_NICHO[n.slug] ?? '🎨'}</span>
                {n.name}
              </span>
            ))}
          </div>
        )}

        {/* Aviso: tentou abrir algo que ainda não tem */}
        {ferramentaBloqueada && ferramentaBloqueada.state !== 'aberta' && (
          <div className="rounded-xl border border-[#FEC649]/60 bg-[#FEC649]/15 px-4 py-3 text-sm text-[#2D2D2D]">
            <strong>{ferramentaBloqueada.name}</strong> {textoDoCaminho(ferramentaBloqueada)}.
          </div>
        )}

        {/* Porta de entrada: quatro perguntas que levam à etapa certa */}
        {(() => {
          const porSlug = Object.fromEntries(tools.map(t => [t.slug, t]))
          const receita = porSlug['minha-receita']
          const abre = (t?: ToolView) => !!t && t.state === 'aberta' && !!t.href
          const portas: { rotulo: string; href: string }[] = []
          if (abre(receita)) {
            portas.push({ rotulo: 'Saber quanto cobrar', href: `${receita!.href}?etapa=preco` })
            portas.push({ rotulo: 'Montar uma receita', href: `${receita!.href}?etapa=ingredientes` })
          }
          if (abre(porSlug['deu-problema'])) portas.push({ rotulo: 'Minha peça deu problema', href: porSlug['deu-problema'].href! })
          if (abre(porSlug['meta-de-renda'])) portas.push({ rotulo: 'Começar a vender', href: porSlug['meta-de-renda'].href! })
          if (portas.length < 2) return null
          return (
            <div className="rounded-xl bg-[#6699F3]/10 p-3">
              <p className="text-xs font-bold mb-2">O que você precisa agora?</p>
              <div className="grid grid-cols-2 gap-2">
                {portas.map(p => (
                  <Link key={p.href} href={p.href} className="bg-white border border-border/70 rounded-lg px-3 py-2 text-xs font-semibold leading-tight min-h-[44px] flex items-center hover:border-[#6699F3]/60 handify-transition">
                    {p.rotulo}
                  </Link>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Seções */}
        <div className="flex border-b border-border/70">
          {SECOES.map(s => {
            const n = porSecao[s.key].length
            return (
              <button
                key={s.key}
                onClick={() => setSecao(s.key)}
                title={s.hint}
                className={cn(
                  'flex-1 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors min-h-[44px]',
                  secao === s.key
                    ? 'border-[#6699F3] text-[#6699F3]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {s.label}
                {n > 0 && <span className="ml-1 text-xs font-medium opacity-70">{n}</span>}
              </button>
            )
          })}
        </div>

        {/* Busca — uma só, em todas as seções */}
        <div id="tour-ferramentas-busca" className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar ferramenta…"
            aria-label="Buscar ferramenta"
            className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 min-h-[44px]"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Lista */}
        {lista.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">
              {busca ? 'Nenhuma ferramenta com esse nome' : 'Nada aqui ainda'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lista.map(t => (
              <ToolCard key={t.slug} tool={t} planLink={planLink} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** "abre com o seu primeiro curso" — a frase que diz o caminho, na voz Handify. */
function textoDoCaminho(t: ToolView): string {
  switch (t.state) {
    case 'com_curso':
      return 'abre com o seu primeiro curso'
    case 'com_categoria':
      return `abre com um curso de ${listaEm(t.unlockCategories)} — ou com o Handify Completo`
    case 'com_completo':
      return 'faz parte do Handify Completo'
    case 'em_breve':
      return 'ainda está sendo preparada'
    default:
      return ''
  }
}

function listaEm(nomes: string[]): string {
  const curtos = nomes.map(n => n.replace(/ Artesana(l|is)$/i, ''))
  if (curtos.length <= 1) return curtos[0] ?? ''
  return `${curtos.slice(0, -1).join(', ')} ou ${curtos[curtos.length - 1]}`
}

function ToolCard({ tool, planLink }: { tool: ToolView; planLink: string | null }) {
  const icone = (
    <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center text-xl shrink-0">
      {tool.icon ?? '🧰'}
    </div>
  )

  if (tool.state === 'aberta' && tool.href) {
    return (
      <Link
        href={tool.href}
        className="group bg-white rounded-2xl border border-border/60 hover:border-[#6699F3]/50 hover:shadow-md transition-all p-4 flex items-center gap-3"
      >
        {icone}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#2D2D2D] text-[15px] leading-tight group-hover:text-[#6699F3] transition-colors">
            {tool.name}
          </h3>
          {tool.description && (
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">{tool.description}</p>
          )}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 bg-[#6699F3] text-white text-xs font-bold rounded-lg px-3 min-h-[40px]">
          Abrir <ChevronRight className="w-4 h-4" />
        </span>
      </Link>
    )
  }

  if (tool.state === 'em_breve') {
    return (
      <div className="bg-white rounded-2xl border border-border/60 p-4 flex items-center gap-3 opacity-75">
        {icone}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#2D2D2D] text-[15px] leading-tight">{tool.name}</h3>
          {tool.description && (
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">{tool.description}</p>
          )}
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-[11px] font-black bg-[#FEC649] text-[#0F0F0F] px-2 py-1 rounded-full">
            Em breve
          </span>
          {TIER_LABEL[tool.minTier] && (
            <span className="block text-[10px] text-muted-foreground mt-1">{TIER_LABEL[tool.minTier]}</span>
          )}
        </span>
      </div>
    )
  }

  // Trancada: mostra o resultado que ela teria, borrado, e o caminho.
  const caminho =
    tool.state === 'com_completo'
      ? { texto: 'No Handify Completo', botao: 'Desbloquear', href: planLink ?? '/cursos', externo: !!planLink }
      : tool.state === 'com_categoria'
      ? { texto: `Com um curso de ${listaEm(tool.unlockCategories)}`, botao: 'Ver cursos', href: '/cursos', externo: false }
      : { texto: 'Com o seu primeiro curso', botao: 'Ver cursos', href: '/cursos', externo: false }

  return (
    <div className="bg-white rounded-2xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F5F5F0] flex items-center justify-center text-xl shrink-0">
          {tool.icon ?? '🧰'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#2D2D2D] text-[15px] leading-tight">{tool.name}</h3>
          {tool.description && (
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">{tool.description}</p>
          )}
        </div>
      </div>

      {tool.preview.length > 0 && (
        <div
          aria-hidden
          className="rounded-lg border border-dashed border-border/70 px-3 py-2 space-y-1 select-none pointer-events-none"
          style={{ filter: 'blur(2.5px)', opacity: 0.65 }}
        >
          {tool.preview.slice(0, 3).map((p, i) => (
            <div key={i} className="flex justify-between text-xs tabular-nums">
              <span>{p.label}</span>
              <b>{p.value}</b>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground leading-snug">
          {caminho.texto}
          {tool.state === 'com_categoria' && planLink && (
            <>
              {' '}— ou{' '}
              <a href={planLink} target="_blank" rel="noopener noreferrer" className="text-[#6699F3] font-semibold underline">
                o Completo
              </a>
            </>
          )}
        </span>
        {caminho.externo ? (
          <a
            href={caminho.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center bg-[#6699F3] text-white text-xs font-bold rounded-lg px-3 min-h-[40px] hover:bg-[#5580d4] transition-colors"
          >
            {caminho.botao}
          </a>
        ) : (
          <Link
            href={caminho.href}
            className={cn(
              'shrink-0 inline-flex items-center text-xs font-bold rounded-lg px-3 min-h-[40px] transition-colors',
              'bg-[#72CF92] text-[#0F0F0F] hover:bg-[#5fbf80]'
            )}
          >
            {caminho.botao}
          </Link>
        )}
      </div>
    </div>
  )
}
