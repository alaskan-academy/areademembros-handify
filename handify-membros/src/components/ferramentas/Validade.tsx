'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Copy, Check, Plus, X, ShieldAlert, AlertTriangle, Lightbulb, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TIPOS,
  calcularValidade,
  temAgua,
  tiposLiberados,
  cursosQueLiberam,
  type TipoProduto,
  type Conservante,
  type Aroma,
  type Embalagem,
  type Insumo,
} from '@/lib/ferramentas/validade'

/**
 * Validade do produto — responde na hora, sem botão de calcular: cada escolha
 * refaz a conta. Termina com o texto pronto para o rótulo (fabricação,
 * validade, lote) e as sugestões de aditivo pelo problema que apareceu.
 */

const INPUT = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Opcao({ ativo, onClick, children, className }: { ativo: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'rounded-lg border text-left px-3 py-2 text-sm min-h-[44px] handify-transition',
        ativo ? 'border-[#6699F3] bg-[#6699F3]/10 font-semibold text-[#2D2D2D]' : 'border-border bg-white text-muted-foreground hover:border-[#6699F3]/50',
        className
      )}
    >
      {children}
    </button>
  )
}

function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-border/60 p-4 space-y-3">
      <div>
        <p className="font-bold">{titulo}</p>
        {ajuda && <p className="text-xs text-muted-foreground mt-0.5">{ajuda}</p>}
      </div>
      {children}
    </section>
  )
}

function Marcar({ marcado, onChange, titulo, detalhe }: { marcado: boolean; onChange: (v: boolean) => void; titulo: string; detalhe: string }) {
  return (
    <label className={cn('flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer min-h-[44px]', marcado ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border bg-white')}>
      <input type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} className="mt-1 w-4 h-4 accent-[#6699F3]" />
      <span>
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{detalhe}</span>
      </span>
    </label>
  )
}

const ICONE = { perigo: ShieldAlert, atencao: AlertTriangle, dica: Lightbulb } as const

export default function Validade({
  categorias,
  tudoLiberado,
  voltar,
  insumosEstoque = [],
  tipoInicial,
  insumosIniciais = [],
}: {
  categorias: string[]
  tudoLiberado: boolean
  voltar?: string
  insumosEstoque?: { nome: string; validade: string }[]
  /** Vindo da receita: o tipo do produto e os insumos com data já entram preenchidos. */
  tipoInicial?: TipoProduto
  insumosIniciais?: { nome: string; validade: string }[]
}) {
  // Os tipos seguem o curso que ela comprou — os outros ficam visíveis e travados.
  const liberados = useMemo(() => tiposLiberados(categorias, tudoLiberado), [categorias, tudoLiberado])
  const [tipo, setTipo] = useState<TipoProduto>(tipoInicial && liberados.includes(tipoInicial) ? tipoInicial : liberados[0] ?? 'glicerinado')
  const [fabricacao, setFabricacao] = useState(hojeISO)
  const [conservante, setConservante] = useState<Conservante>('nenhum')
  const [prazoConservante, setPrazoConservante] = useState('')
  const [antioxidante, setAntioxidante] = useState(false)
  const [oleosFrageis, setOleosFrageis] = useState(false)
  const [frescos, setFrescos] = useState(false)
  const [aroma, setAroma] = useState<Aroma>('essencia')
  const [embalagem, setEmbalagem] = useState<Embalagem>('fechada')
  const [insumos, setInsumos] = useState<(Insumo & { key: number })[]>(() => insumosIniciais.map((i, k) => ({ key: k + 1, nome: i.nome, validade: i.validade })))
  const [copiado, setCopiado] = useState(false)

  const agua = temAgua(tipo)
  const vela = tipo === 'vela'
  const perguntaConservante = agua || frescos

  const resultado = useMemo(
    () =>
      fabricacao
        ? calcularValidade({
            tipo,
            fabricacao,
            conservante: perguntaConservante ? conservante : 'nenhum',
            prazoConservanteMeses: prazoConservante ? Math.max(1, Math.round(parseFloat(prazoConservante.replace(',', '.')) || 0)) : null,
            antioxidante: vela ? false : antioxidante,
            oleosFrageis: vela ? false : oleosFrageis,
            frescos: vela ? false : frescos,
            aroma,
            embalagem,
            insumos: insumos.map(i => ({ nome: i.nome, validade: i.validade })),
          })
        : null,
    [tipo, fabricacao, conservante, prazoConservante, antioxidante, oleosFrageis, frescos, aroma, embalagem, insumos, perguntaConservante, vela]
  )

  const textoRotulo = resultado ? `Fabricação ${resultado.rotulo.fabricacao} | Validade ${resultado.rotulo.validade} | Lote ${resultado.rotulo.lote}` : ''

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoRotulo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* sem clipboard (http antigo): o texto está na tela para selecionar */
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Ferramentas
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
            Validade do <span className="text-[#6699F3]">produto</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Quanto tempo dura, o que limita, e o texto pronto para o rótulo. A regra: o ingrediente que vence primeiro manda.</p>
        </div>

        <Secao titulo="O que você fez?">
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map(t => {
              if (liberados.includes(t.key)) {
                return (
                  <Opcao key={t.key} ativo={tipo === t.key} onClick={() => setTipo(t.key)}>
                    <span className="block">{t.emoji} {t.nome}</span>
                    <span className="block text-[11px] font-normal text-muted-foreground">{t.exemplo}</span>
                  </Opcao>
                )
              }
              const cursos = cursosQueLiberam(t.key).join(' ou ')
              return (
                <Link
                  key={t.key}
                  href="/cursos"
                  aria-label={`${t.nome}: com o curso de ${cursos}`}
                  className="rounded-lg border border-dashed border-border bg-[#F5F5F0] px-3 py-2 text-left min-h-[44px] block hover:border-[#6699F3]/50 handify-transition"
                >
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Lock className="w-3.5 h-3.5 shrink-0" /> {t.emoji} {t.nome}
                  </span>
                  <span className="block text-[11px] font-semibold text-[#6699F3]">Com o curso de {cursos}</span>
                </Link>
              )
            })}
          </div>
        </Secao>

        <Secao titulo={tipo === 'cold_process' ? 'Quando terminou a cura?' : 'Quando fez?'} ajuda={tipo === 'cold_process' ? 'A validade conta do fim da cura (4 a 6 semanas), não do dia que despejou.' : undefined}>
          <input type="date" value={fabricacao} onChange={e => setFabricacao(e.target.value)} aria-label="Data de fabricação" className={INPUT} />
        </Secao>

        {perguntaConservante && (
          <Secao titulo="Tem conservante?" ajuda={agua ? 'Produto com água precisa. Vitamina E e extrato de semente de toranja não são conservantes.' : 'Ingrediente fresco traz água e alimento para micróbio.'}>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['nenhum', 'Não'],
                ['sintetico', 'Sim, sintético'],
                ['natural', 'Sim, natural'],
                ['nao_sei', 'Não sei'],
              ] as [Conservante, string][]).map(([k, label]) => (
                <Opcao key={k} ativo={conservante === k} onClick={() => setConservante(k)}>{label}</Opcao>
              ))}
            </div>
            {(conservante === 'sintetico' || conservante === 'natural') && (
              <label className="block text-xs font-medium text-muted-foreground">
                Prazo que o fabricante do conservante indica (meses)
                <input value={prazoConservante} onChange={e => setPrazoConservante(e.target.value)} inputMode="numeric" placeholder="3" className={INPUT} />
              </label>
            )}
          </Secao>
        )}

        {!vela && (
          <Secao titulo="Na receita tem…" ajuda="Marque o que se aplica.">
            <Marcar marcado={oleosFrageis} onChange={setOleosFrageis} titulo="Óleo que rancifica rápido" detalhe="girassol, semente de uva, cânhamo, linhaça, rosa mosqueta" />
            <Marcar marcado={frescos} onChange={setFrescos} titulo="Ingrediente fresco" detalhe="fruta, leite, ervas in natura, mel com água" />
            <Marcar marcado={antioxidante} onChange={setAntioxidante} titulo="Antioxidante" detalhe="vitamina E, extrato de alecrim (ROE) ou BHT" />
          </Secao>
        )}

        <Secao titulo="Aroma">
          <div className="grid grid-cols-3 gap-2">
            {([
              ['nenhum', 'Sem aroma'],
              ['essencia', 'Essência'],
              ['oleo_essencial', 'Óleo essencial'],
            ] as [Aroma, string][]).map(([k, label]) => (
              <Opcao key={k} ativo={aroma === k} onClick={() => setAroma(k)} className="text-center">{label}</Opcao>
            ))}
          </div>
        </Secao>

        {tipo === 'glicerinado' && (
          <Secao titulo="Embalagem" ajuda="Glicerinado sem embalar sua e perde aroma.">
            <div className="grid grid-cols-2 gap-2">
              <Opcao ativo={embalagem === 'fechada'} onClick={() => setEmbalagem('fechada')}>Embalado (filme, saquinho, pote fechado)</Opcao>
              <Opcao ativo={embalagem === 'aberta'} onClick={() => setEmbalagem('aberta')}>Sem embalar</Opcao>
            </div>
          </Secao>
        )}

        <Secao titulo="Validade dos insumos (se souber)" ajuda="Está no rótulo da base, do óleo, da essência. O que vence primeiro manda — vale a pena olhar.">
          {insumos.map(i => (
            <div key={i.key} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <label className="block text-xs font-medium text-muted-foreground">
                Insumo
                <input value={i.nome} onChange={e => setInsumos(l => l.map(x => (x.key === i.key ? { ...x, nome: e.target.value } : x)))} placeholder="Ex.: Base glicerinada" className={INPUT} maxLength={60} />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Vence em
                <input type="date" value={i.validade ?? ''} onChange={e => setInsumos(l => l.map(x => (x.key === i.key ? { ...x, validade: e.target.value || null } : x)))} className={INPUT} />
              </label>
              <button type="button" onClick={() => setInsumos(l => l.filter(x => x.key !== i.key))} aria-label="Tirar insumo" className="w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setInsumos(l => [...l, { key: Date.now(), nome: '', validade: null }])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6699F3] min-h-[44px]">
              <Plus className="w-4 h-4" /> {insumos.length ? 'Mais um insumo' : 'Adicionar insumo'}
            </button>
            {insumosEstoque.length > 0 && (
              <label className="text-xs text-muted-foreground inline-flex items-center gap-2 min-h-[44px]">
                Puxar do estoque
                <select
                  value=""
                  aria-label="Puxar insumo do estoque"
                  onChange={e => {
                    const i = insumosEstoque[Number(e.target.value)]
                    if (i) setInsumos(l => [...l, { key: Date.now(), nome: i.nome, validade: i.validade }])
                  }}
                  className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm min-h-[36px]"
                >
                  <option value="">— escolher —</option>
                  {insumosEstoque.map((i, k) => (
                    <option key={k} value={k}>{i.nome} — vence {i.validade.split('-').reverse().join('/')}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </Secao>

        {resultado && (
          <section className="bg-[#0F0F0F] text-white rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Validade estimada</p>
              <p className="text-2xl font-black leading-tight mt-1">
                {resultado.prazoTexto} <span className="text-[#72CF92]">= vence em {resultado.rotulo.validade}</span>
              </p>
              <p className="text-sm text-white/80 mt-1">O que limita: {resultado.limitante}.</p>
            </div>

            <div className="rounded-xl bg-white/10 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Para o rótulo</p>
              <p className="text-sm font-semibold break-words">{textoRotulo}</p>
              {voltar === 'receita' && (
                <Link
                  href={`/ferramentas/minha-receita?etapa=ficha&validade=${resultado.vence}`}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] hover:bg-[#5580d4] handify-transition"
                >
                  <Check className="w-4 h-4" /> Usar na receita
                </Link>
              )}
              {voltar === 'rotulo' && (
                <Link
                  href={`/ferramentas/rotulo?fabricacao=${fabricacao}&validade=${resultado.vence}&lote=${encodeURIComponent(resultado.rotulo.lote)}`}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[44px] hover:bg-[#5580d4] handify-transition"
                >
                  <Check className="w-4 h-4" /> Usar no rótulo
                </Link>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/60">Lote é sugestão (mês, ano, sequência) — mude como quiser.</p>
                <button type="button" onClick={copiar} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-white text-[#0F0F0F] text-xs font-semibold px-3 min-h-[36px]">
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </section>
        )}

        {resultado && resultado.alertas.length > 0 && (
          <div className="space-y-2">
            {resultado.alertas.map((a, i) => {
              const Icone = ICONE[a.nivel]
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-sm flex items-start gap-3',
                    a.nivel === 'perigo' ? 'bg-red-50 border-red-200 text-red-800' : a.nivel === 'atencao' ? 'bg-[#FEC649]/15 border-[#FEC649]/60' : 'bg-white border-border/60 text-muted-foreground'
                  )}
                >
                  <Icone className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{a.texto}</p>
                </div>
              )
            })}
          </div>
        )}

        {resultado && resultado.sugestoes.length > 0 && (
          <Secao titulo="Aditivos que ajudam" ajuda="Sugestão pelo problema que apareceu — sempre uma opção natural e uma sintética. Dose sobre o peso total da receita; siga a faixa do fabricante do seu insumo.">
            {resultado.sugestoes.map(s => (
              <div key={s.titulo} className="rounded-lg bg-[#F5F5F0] p-3 space-y-1.5">
                <p className="text-sm font-semibold">{s.titulo}</p>
                <ul className="text-sm space-y-1 list-disc pl-4">
                  {s.opcoes.map(o => <li key={o}>{o}</li>)}
                </ul>
                {s.nota && <p className="text-xs text-muted-foreground">{s.nota}</p>}
              </div>
            ))}
          </Secao>
        )}
      </div>
    </div>
  )
}
