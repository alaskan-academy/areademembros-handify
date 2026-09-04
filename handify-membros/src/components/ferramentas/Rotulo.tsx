'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Copy, Check, FileDown, CalendarClock, ShieldAlert, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TAMANHOS,
  TIPOS_SUGERIDOS,
  dadosVazios,
  linhasRotulo,
  textoRotulo,
  porFolha,
  rotuloSchema,
  type DadosRotulo,
  type Tamanho,
} from '@/lib/rotulo/tipos'

/**
 * Rótulo do sabonete — ela preenche o que a ANVISA pede, vê a etiqueta na
 * hora e baixa a folha para imprimir. Não sabe a validade? Vai à ferramenta
 * de Validade e volta com fabricação, validade e lote preenchidos (o resto
 * fica guardado no aparelho enquanto isso).
 */

const RASCUNHO = 'handify_rotulo_rascunho'
const INPUT = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'
const AREA = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm min-h-[72px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'

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

function Campo({ rotulo, children, dica }: { rotulo: string; children: React.ReactNode; dica?: string }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {rotulo}
      {children}
      {dica && <span className="block text-[11px] font-normal mt-1">{dica}</span>}
    </label>
  )
}

export default function Rotulo({ marca, inicial }: { marca: Partial<DadosRotulo>; inicial: Partial<DadosRotulo> }) {
  const [d, setD] = useState<DadosRotulo>(() => ({ ...dadosVazios(), ...marca, ...inicial }))
  const [carregou, setCarregou] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Rascunho no aparelho: sobrevive à ida até a Validade e à volta.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(RASCUNHO)
      if (salvo) {
        const r = JSON.parse(salvo) as Partial<DadosRotulo>
        // O que veio pela URL (fabricação, validade, lote) vence o rascunho.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setD(atual => ({ ...atual, ...r, ...inicial }))
      }
    } catch {}
    setCarregou(true)
  }, [inicial])
  useEffect(() => {
    if (!carregou) return
    try { localStorage.setItem(RASCUNHO, JSON.stringify(d)) } catch {}
  }, [d, carregou])

  const set = (patch: Partial<DadosRotulo>) => setD(x => ({ ...x, ...patch }))
  const mudarTamanho = (t: Tamanho) => setD(x => ({ ...x, tamanho: t, quantidade: porFolha(t) }))

  const linhas = useMemo(() => linhasRotulo(d), [d])
  const tam = TAMANHOS[d.tamanho]

  const checklist = [
    { ok: !!d.produto, texto: 'Nome do produto e o que é (sabonete em barra, hidratante…)' },
    { ok: !!d.marca, texto: 'Marca' },
    { ok: !!d.peso, texto: 'Conteúdo (peso ou volume)' },
    { ok: !!d.ingredientes, texto: 'Ingredientes, do maior para o menor' },
    { ok: !!d.modoUso, texto: 'Modo de uso' },
    { ok: !!d.advertencias, texto: 'Advertências' },
    { ok: !!d.validade && !!d.lote, texto: 'Validade e lote' },
    { ok: !!d.fabricante, texto: 'Quem fabrica e como falar com você' },
  ]

  function baixar() {
    const parsed = rotuloSchema.safeParse(d)
    if (!parsed.success) { setErro(parsed.error.issues[0].message); return }
    setErro('')
    formRef.current?.submit()
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoRotulo(d))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
        <Link href="/ferramentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
          <ChevronLeft className="w-4 h-4" /> Ferramentas
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F] leading-tight">
            Rótulo do <span className="text-[#6699F3]">sabonete</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Tudo que precisa constar, no tamanho da etiqueta. Preencha, veja a prévia e baixe a folha para imprimir.</p>
        </div>

        {/* Prévia */}
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévia — {tam.medida}</p>
          <div className="mx-auto bg-white border border-border shadow-sm rounded-sm p-3 overflow-hidden" style={{ width: '100%', maxWidth: `${tam.w * 40}px`, aspectRatio: `${tam.w} / ${tam.h}` }}>
            <div className="h-full overflow-hidden leading-tight">
              {linhas.map((l, i) => (
                <p
                  key={i}
                  className={cn(
                    'break-words',
                    l.papel === 'marca' && 'text-[11px] font-bold text-muted-foreground',
                    l.papel === 'produto' && 'text-[15px] font-black text-[#0F0F0F] mt-0.5',
                    l.papel === 'texto' && 'text-[9px] text-muted-foreground mt-1',
                    l.papel === 'destaque' && 'text-[9px] font-bold text-[#0F0F0F] mt-1'
                  )}
                >
                  {l.texto}
                </p>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">A prévia é aproximada; no PDF a letra encolhe até caber.</p>
        </section>

        <Secao titulo="O produto">
          <Campo rotulo="Marca"><input value={d.marca} onChange={e => set({ marca: e.target.value })} placeholder="Ex.: Ateliê da Maria" className={INPUT} maxLength={60} /></Campo>
          <Campo rotulo="Nome do produto"><input value={d.produto} onChange={e => set({ produto: e.target.value })} placeholder="Ex.: Sabonete de lavanda" className={INPUT} maxLength={80} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="O que é">
              <input value={d.tipo} onChange={e => set({ tipo: e.target.value })} list="tipos-rotulo" placeholder="Ex.: Sabonete em barra" className={INPUT} maxLength={60} />
              <datalist id="tipos-rotulo">{TIPOS_SUGERIDOS.map(t => <option key={t} value={t} />)}</datalist>
            </Campo>
            <Campo rotulo="Conteúdo"><input value={d.peso} onChange={e => set({ peso: e.target.value })} placeholder="Ex.: 90 g" className={INPUT} maxLength={20} /></Campo>
          </div>
        </Secao>

        <Secao titulo="Ingredientes" ajuda="Do maior para o menor. Se souber o nome INCI (está na embalagem do insumo), use — a ANVISA pede assim.">
          <textarea value={d.ingredientes} onChange={e => set({ ingredientes: e.target.value })} placeholder="Ex.: Sodium Palmate, Glycerin, Aqua, Parfum, Lavandula Angustifolia Oil, CI 77007" className={AREA} maxLength={600} />
        </Secao>

        <Secao titulo="Modo de uso e advertências" ajuda="Já vem escrito do jeito que a ANVISA pede — mude se o seu produto for diferente.">
          <Campo rotulo="Modo de uso"><textarea value={d.modoUso} onChange={e => set({ modoUso: e.target.value })} className={AREA} maxLength={200} /></Campo>
          <Campo rotulo="Advertências"><textarea value={d.advertencias} onChange={e => set({ advertencias: e.target.value })} className={AREA} maxLength={300} /></Campo>
        </Secao>

        <Secao titulo="Datas e lote">
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Fabricação"><input type="date" value={d.fabricacao} onChange={e => set({ fabricacao: e.target.value })} className={INPUT} /></Campo>
            <Campo rotulo="Validade"><input type="date" value={d.validade} onChange={e => set({ validade: e.target.value })} className={INPUT} /></Campo>
          </div>
          <Link href="/ferramentas/validade?voltar=rotulo" className="inline-flex items-center gap-2 w-full justify-center rounded-lg border border-[#6699F3] text-[#6699F3] text-sm font-semibold min-h-[44px] hover:bg-[#6699F3]/5 handify-transition">
            <CalendarClock className="w-4 h-4" /> Não sei a validade — calcular
          </Link>
          <Campo rotulo="Lote" dica="Sugestão: mês, ano e sequência — 0926-01."><input value={d.lote} onChange={e => set({ lote: e.target.value })} placeholder="Ex.: 0926-01" className={INPUT} maxLength={20} /></Campo>
        </Secao>

        <Secao titulo="Quem fabrica" ajuda="Nome ou razão social. CNPJ é opcional no rótulo artesanal, mas conta pontos com a cliente.">
          <Campo rotulo="Fabricado por"><input value={d.fabricante} onChange={e => set({ fabricante: e.target.value })} placeholder="Ex.: Maria Silva" className={INPUT} maxLength={80} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="CNPJ ou CPF (opcional)"><input value={d.documento} onChange={e => set({ documento: e.target.value })} placeholder="00.000.000/0001-00" className={INPUT} maxLength={30} /></Campo>
            <Campo rotulo="Contato"><input value={d.contato} onChange={e => set({ contato: e.target.value })} placeholder="WhatsApp, @instagram, cidade" className={INPUT} maxLength={120} /></Campo>
          </div>
        </Secao>

        <Secao titulo="Tamanho da etiqueta">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TAMANHOS) as Tamanho[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => mudarTamanho(t)}
                aria-pressed={d.tamanho === t}
                className={cn('rounded-lg border px-2 py-2 text-left min-h-[44px] handify-transition', d.tamanho === t ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border bg-white')}
              >
                <span className="block text-sm font-semibold">{TAMANHOS[t].nome}</span>
                <span className="block text-[11px] text-muted-foreground">{TAMANHOS[t].medida}</span>
                <span className="block text-[11px] text-muted-foreground">{TAMANHOS[t].uso}</span>
                <span className="block text-[11px] text-[#6699F3] font-semibold">{porFolha(t)} por folha</span>
              </button>
            ))}
          </div>
          <Campo rotulo="Quantos rótulos">
            <input value={d.quantidade} onChange={e => set({ quantidade: Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))) })} inputMode="numeric" className={INPUT} />
          </Campo>
        </Secao>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="space-y-2">
          <button type="button" onClick={baixar} className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[48px] hover:bg-[#5580d4] handify-transition">
            <FileDown className="w-4 h-4" /> Baixar folha de rótulos (PDF)
          </button>
          <button type="button" onClick={copiar} className="inline-flex items-center justify-center gap-2 w-full rounded-lg border border-border bg-white text-sm font-semibold min-h-[44px]">
            {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiado ? 'Copiado' : 'Copiar o texto do rótulo'}
          </button>
          <p className="text-[11px] text-muted-foreground text-center">A4, {porFolha(d.tamanho)} por folha, com borda fina para recortar. Abre em outra aba — imprima ou salve.</p>
        </div>

        <form ref={formRef} method="post" action="/api/ferramentas/rotulo/pdf" target="_blank" className="hidden">
          <input type="hidden" name="dados" value={JSON.stringify(d)} readOnly />
        </form>

        <Secao titulo="O que a ANVISA pede no rótulo">
          <ul className="space-y-1.5">
            {checklist.map(c => (
              <li key={c.texto} className="flex items-start gap-2 text-sm">
                {c.ok ? <CheckCircle2 className="w-4 h-4 text-[#72CF92] shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />}
                <span className={cn(!c.ok && 'text-muted-foreground')}>{c.texto}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg bg-[#FEC649]/15 border border-[#FEC649]/60 px-3 py-2.5 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Não escreva &quot;hipoalergênico&quot;, &quot;testado dermatologicamente&quot;, &quot;natural&quot; ou &quot;orgânico&quot; sem teste ou certificado — a fiscalização autua por isso. Para vender de verdade, cosmético (inclusive sabonete artesanal) precisa de notificação na ANVISA e de responsável técnico; o rótulo é a parte que dá para deixar certa agora.</p>
          </div>
        </Secao>
      </div>
    </div>
  )
}
