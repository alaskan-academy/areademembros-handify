'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Copy, Check, FileDown, CalendarClock, ShieldAlert, CheckCircle2, Circle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PALETA,
  ESTILOS,
  PRESETS,
  FAMILIAS,
  PADRAO,
  TIPOS_SUGERIDOS,
  ROTULOS_CAMPOS,
  LIMITES,
  dadosVazios,
  linhasRotulo,
  textoRotulo,
  porFolha,
  rotuloSchema,
  type DadosRotulo,
  type Familia,
  type Estilo,
  type Forma,
} from '@/lib/rotulo/tipos'

/**
 * Rótulo do produto — sabonete, cosmético ou vela. Ela preenche o que precisa
 * constar, escolhe estilo, cor, forma e tamanho (livre), vê a etiqueta na hora
 * e baixa a folha para imprimir. Não sabe a validade? Vai à ferramenta de
 * Validade e volta com fabricação, validade e lote preenchidos (o resto fica
 * guardado no aparelho enquanto isso).
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

function Opcao({ ativo, onClick, children, className }: { ativo: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn('rounded-lg border text-left px-3 py-2 text-sm min-h-[44px] handify-transition', ativo ? 'border-[#6699F3] bg-[#6699F3]/10 font-semibold' : 'border-border bg-white text-muted-foreground hover:border-[#6699F3]/50', className)}
    >
      {children}
    </button>
  )
}

function hexAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const numero = (s: string) => parseFloat(String(s).replace(',', '.'))
const dentro = (v: number, lim: { min: number; max: number }) => !isNaN(v) && v >= lim.min && v <= lim.max

/** A etiqueta como vai sair — mesma hierarquia do PDF, em CSS. */
function Previa({ d }: { d: DadosRotulo }) {
  const linhas = linhasRotulo(d)
  const redondo = d.forma === 'redondo'
  const serif = d.estilo !== 'moderno'
  const temFaixa = d.estilo === 'moderno' && !redondo && !!d.marca
  const base = Math.min(12, Math.max(8, Math.min(d.largura, d.altura) * 1.5))
  const fonteNome = serif ? 'Georgia, "Times New Roman", serif' : 'inherit'
  const corpo = linhas.filter(l => !(l.papel === 'marca' && temFaixa))
  // A divisória entra uma vez, antes do primeiro texto miúdo.
  const idxDivisoria = corpo.findIndex((l, i) => i > 0 && (l.papel === 'texto' || l.papel === 'destaque'))
  return (
    <div
      className="mx-auto overflow-hidden"
      style={{
        width: '100%',
        maxWidth: `${Math.min(19, d.largura) * 40}px`,
        aspectRatio: `${d.largura} / ${d.altura}`,
        borderRadius: redondo ? '50%' : '8px',
        border: `${d.estilo === 'moderno' ? 2 : 1}px solid ${d.cor}`,
        boxShadow: d.estilo === 'classico' ? `inset 0 0 0 3px #fff, inset 0 0 0 4px ${d.cor}` : '0 1px 3px rgba(0,0,0,0.08)',
        background: d.estilo === 'delicado' ? hexAlpha(d.cor, 0.08) : '#fff',
        textAlign: redondo ? 'center' : 'left',
      }}
    >
      {temFaixa && (
        <div style={{ background: d.cor, color: '#fff', padding: '4px 8px', textAlign: 'center', fontSize: base * 0.8, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
          {d.marca}
        </div>
      )}
      <div style={{ padding: redondo ? '16% 14%' : temFaixa ? '4% 6% 6%' : '7% 6%', lineHeight: 1.25 }}>
        {corpo.map((l, i) => {
          const mostrarDivisoria = i === idxDivisoria
          return (
            <div key={i}>
              {mostrarDivisoria && (
                <div className="flex items-center justify-center gap-1 my-1.5">
                  <span style={{ width: '18%', height: 1, background: d.cor, opacity: 0.8 }} />
                  {d.estilo === 'delicado' && <span style={{ width: 4, height: 4, borderRadius: '50%', background: d.cor }} />}
                  {d.estilo === 'delicado' && <span style={{ width: '18%', height: 1, background: d.cor, opacity: 0.8 }} />}
                </div>
              )}
              <p
                className="break-words"
                style={
                  l.papel === 'marca'
                    ? { color: d.cor, fontSize: base * 0.8, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }
                    : l.papel === 'produto'
                      ? { fontFamily: fonteNome, fontWeight: 800, fontSize: base * 1.6, color: '#1c1c1c', textAlign: 'center', marginTop: 2 }
                      : l.papel === 'tipo'
                        ? { color: d.cor, fontSize: base * 0.95, textAlign: 'center', fontStyle: d.estilo === 'delicado' ? 'italic' : 'normal', fontFamily: d.estilo === 'delicado' ? fonteNome : 'inherit' }
                        : l.papel === 'destaque'
                          ? { fontWeight: 700, fontSize: base * 0.8, color: '#1c1c1c', textAlign: 'center', marginTop: 4 }
                          : l.papel === 'quem'
                            ? { fontSize: base * 0.74, color: '#585858', textAlign: 'center', marginTop: 2 }
                            : { fontSize: base * 0.78, color: '#585858', marginTop: 3, textAlign: redondo ? 'center' : 'left' }
                }
              >
                {l.texto}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Rotulo({ marca, inicial, familias }: { marca: Partial<DadosRotulo>; inicial: Partial<DadosRotulo>; familias: Familia[] }) {
  const familiaPadrao: Familia = familias[0] ?? 'cosmetico'
  const [d, setD] = useState<DadosRotulo>(() => ({ ...dadosVazios(familiaPadrao), ...marca, ...inicial }))
  const [dim, setDim] = useState({ l: '9', a: '5' })
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
        // O que veio pela URL (fabricação, validade, lote) vence o rascunho;
        // família fora do curso dela volta para a liberada.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setD(atual => {
          const fam = r.familia && familias.includes(r.familia) ? r.familia : familiaPadrao
          const proximo = { ...atual, ...r, ...inicial, familia: fam }
          setDim({ l: String(proximo.largura), a: String(proximo.altura) })
          return proximo
        })
      }
    } catch {}
    setCarregou(true)
  }, [inicial, familias, familiaPadrao])
  useEffect(() => {
    if (!carregou) return
    try { localStorage.setItem(RASCUNHO, JSON.stringify(d)) } catch {}
  }, [d, carregou])

  const set = (patch: Partial<DadosRotulo>) => setD(x => ({ ...x, ...patch }))
  const redondo = d.forma === 'redondo'
  const campos = ROTULOS_CAMPOS[d.familia]

  function mudarFamilia(f: Familia) {
    setD(x => {
      const antiga = PADRAO[x.familia]
      const nova = PADRAO[f]
      return {
        ...x,
        familia: f,
        tipo: !x.tipo || x.tipo === antiga.tipo ? nova.tipo : x.tipo,
        modoUso: !x.modoUso || x.modoUso === antiga.modoUso ? nova.modoUso : x.modoUso,
        advertencias: !x.advertencias || x.advertencias === antiga.advertencias ? nova.advertencias : x.advertencias,
      }
    })
  }

  function aplicarTamanho(forma: Forma, largura: number, altura: number) {
    setDim({ l: String(largura), a: String(altura) })
    set({ forma, largura, altura, quantidade: porFolha(largura, altura) })
  }
  function mudarDim(k: 'l' | 'a', v: string) {
    setDim(x => (redondo ? { l: v, a: v } : { ...x, [k]: v }))
    const n = numero(v)
    if (k === 'l' && dentro(n, LIMITES.largura)) {
      const altura = redondo ? n : d.altura
      set({ largura: n, altura, quantidade: porFolha(n, altura) })
    } else if (k === 'a' && dentro(n, LIMITES.altura)) {
      set({ altura: n, quantidade: porFolha(d.largura, n) })
    }
  }
  function mudarForma(f: Forma) {
    if (f === 'redondo') aplicarTamanho('redondo', d.largura, d.largura)
    else aplicarTamanho('retangular', d.largura, d.altura === d.largura ? Math.round(d.largura * 0.6 * 2) / 2 : d.altura)
  }

  const tamanhoOk = dentro(numero(dim.l), LIMITES.largura) && dentro(numero(dim.a), LIMITES.altura)

  const checklist = useMemo(
    () =>
      d.familia === 'vela'
        ? [
            { ok: !!d.produto, texto: 'Nome do produto e o que é (vela aromática, em pote…)' },
            { ok: !!d.marca, texto: 'Marca' },
            { ok: !!d.peso, texto: 'Conteúdo (peso) — obrigatório para vender em loja' },
            { ok: !!d.ingredientes, texto: 'Composição (cera, essência, pavio)' },
            { ok: !!d.modoUso, texto: 'Como usar (primeira queima, pavio a 5 mm)' },
            { ok: !!d.advertencias, texto: 'Avisos de segurança' },
            { ok: !!d.lote, texto: 'Lote (validade é opcional: "melhor até")' },
            { ok: !!d.fabricante, texto: 'Quem fabrica e como falar com você' },
          ]
        : [
            { ok: !!d.produto, texto: 'Nome do produto e o que é (sabonete em barra, hidratante…)' },
            { ok: !!d.marca, texto: 'Marca' },
            { ok: !!d.peso, texto: 'Conteúdo (peso ou volume)' },
            { ok: !!d.ingredientes, texto: 'Ingredientes, do maior para o menor' },
            { ok: !!d.modoUso, texto: 'Modo de uso' },
            { ok: !!d.advertencias, texto: 'Advertências' },
            { ok: !!d.validade && !!d.lote, texto: 'Validade e lote' },
            { ok: !!d.fabricante, texto: 'Quem fabrica e como falar com você' },
          ],
    [d]
  )

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
            Rótulo do <span className="text-[#6699F3]">produto</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Tudo que precisa constar, bonito, no tamanho da sua etiqueta. Preencha, veja a prévia e baixe a folha para imprimir.</p>
        </div>

        {/* Prévia */}
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Prévia — {redondo ? `${d.largura} cm de diâmetro` : `${d.largura} × ${d.altura} cm`}
          </p>
          <Previa d={d} />
          <p className="text-[11px] text-muted-foreground text-center">A prévia é aproximada; no PDF a letra encolhe até caber.</p>
        </section>

        <Secao titulo="É rótulo de quê?">
          <div className="grid grid-cols-2 gap-2">
            {FAMILIAS.map(f =>
              familias.includes(f.key) ? (
                <Opcao key={f.key} ativo={d.familia === f.key} onClick={() => mudarFamilia(f.key)}>
                  {f.emoji} {f.nome}
                </Opcao>
              ) : (
                <Link key={f.key} href="/cursos" aria-label={`${f.nome}: com o curso de ${f.cursos}`} className="rounded-lg border border-dashed border-border bg-[#F5F5F0] px-3 py-2 text-left min-h-[44px] block hover:border-[#6699F3]/50 handify-transition">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="w-3.5 h-3.5 shrink-0" /> {f.emoji} {f.nome}</span>
                  <span className="block text-[11px] font-semibold text-[#6699F3]">Com o curso de {f.cursos}</span>
                </Link>
              )
            )}
          </div>
        </Secao>

        <Secao titulo="O produto">
          <Campo rotulo="Marca"><input value={d.marca} onChange={e => set({ marca: e.target.value })} placeholder="Ex.: Ateliê da Maria" className={INPUT} maxLength={60} /></Campo>
          <Campo rotulo="Nome do produto"><input value={d.produto} onChange={e => set({ produto: e.target.value })} placeholder={d.familia === 'vela' ? 'Ex.: Vela de lavanda' : 'Ex.: Sabonete de lavanda'} className={INPUT} maxLength={80} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="O que é">
              <input value={d.tipo} onChange={e => set({ tipo: e.target.value })} list="tipos-rotulo" placeholder={PADRAO[d.familia].tipo} className={INPUT} maxLength={60} />
              <datalist id="tipos-rotulo">{TIPOS_SUGERIDOS[d.familia].map(t => <option key={t} value={t} />)}</datalist>
            </Campo>
            <Campo rotulo="Conteúdo"><input value={d.peso} onChange={e => set({ peso: e.target.value })} placeholder={campos.conteudoExemplo} className={INPUT} maxLength={20} /></Campo>
          </div>
        </Secao>

        <Secao titulo={campos.ingredientes} ajuda={campos.ingredientesAjuda}>
          <textarea value={d.ingredientes} onChange={e => set({ ingredientes: e.target.value })} placeholder={campos.ingredientesExemplo} className={AREA} maxLength={600} />
        </Secao>

        <Secao titulo={d.familia === 'vela' ? 'Como usar e avisos de segurança' : 'Modo de uso e advertências'} ajuda={d.familia === 'vela' ? 'Já vem escrito do jeito que protege você e a cliente — mude se precisar.' : 'Já vem escrito do jeito que a ANVISA pede — mude se o seu produto for diferente.'}>
          <Campo rotulo={campos.modoUso}><textarea value={d.modoUso} onChange={e => set({ modoUso: e.target.value })} className={AREA} maxLength={200} /></Campo>
          <Campo rotulo={d.familia === 'vela' ? 'Avisos de segurança' : 'Advertências'}><textarea value={d.advertencias} onChange={e => set({ advertencias: e.target.value })} className={AREA} maxLength={300} /></Campo>
        </Secao>

        <Secao titulo="Datas e lote">
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Fabricação"><input type="date" value={d.fabricacao} onChange={e => set({ fabricacao: e.target.value })} className={INPUT} /></Campo>
            <Campo rotulo={d.familia === 'vela' ? 'Melhor até (opcional)' : 'Validade'}><input type="date" value={d.validade} onChange={e => set({ validade: e.target.value })} className={INPUT} /></Campo>
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

        <Secao titulo="Aparência">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ESTILOS) as Estilo[]).map(e => (
              <Opcao key={e} ativo={d.estilo === e} onClick={() => set({ estilo: e })}>
                <span className="block">{ESTILOS[e].nome}</span>
                <span className="block text-[11px] font-normal text-muted-foreground">{ESTILOS[e].desc}</span>
              </Opcao>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Cor</p>
            <div className="flex flex-wrap items-center gap-2">
              {PALETA.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => set({ cor: c.hex })}
                  aria-label={c.nome}
                  aria-pressed={d.cor.toLowerCase() === c.hex.toLowerCase()}
                  className={cn('w-9 h-9 rounded-full border-2 handify-transition', d.cor.toLowerCase() === c.hex.toLowerCase() ? 'border-[#0F0F0F] scale-110' : 'border-white shadow')}
                  style={{ background: c.hex }}
                />
              ))}
              <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground min-h-[44px] cursor-pointer">
                <input type="color" value={d.cor} onChange={e => set({ cor: e.target.value })} aria-label="Outra cor" className="w-9 h-9 rounded-full border-0 bg-transparent cursor-pointer" />
                outra
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Opcao ativo={!redondo} onClick={() => mudarForma('retangular')}>▭ Retangular</Opcao>
            <Opcao ativo={redondo} onClick={() => mudarForma('redondo')}>◯ Redondo</Opcao>
          </div>
        </Secao>

        <Secao titulo="Tamanho" ajuda="Toque num pronto ou digite o da sua etiqueta, em centímetros.">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => {
              const ativo = d.forma === p.forma && d.largura === p.largura && d.altura === p.altura
              return (
                <button key={p.nome} type="button" onClick={() => aplicarTamanho(p.forma, p.largura, p.altura)} aria-pressed={ativo} className={cn('rounded-full border px-3 text-xs font-semibold min-h-[36px] handify-transition', ativo ? 'border-[#6699F3] bg-[#6699F3]/10' : 'border-border bg-white text-muted-foreground')}>
                  {p.nome} <span className="font-normal">{p.forma === 'redondo' ? `${p.largura} cm` : `${p.largura}×${p.altura}`}</span>
                </button>
              )
            })}
          </div>
          {redondo ? (
            <Campo rotulo="Diâmetro (cm)"><input value={dim.l} onChange={e => mudarDim('l', e.target.value)} inputMode="decimal" className={INPUT} /></Campo>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Largura (cm)"><input value={dim.l} onChange={e => mudarDim('l', e.target.value)} inputMode="decimal" className={INPUT} /></Campo>
              <Campo rotulo="Altura (cm)"><input value={dim.a} onChange={e => mudarDim('a', e.target.value)} inputMode="decimal" className={INPUT} /></Campo>
            </div>
          )}
          <p className={cn('text-xs', tamanhoOk ? 'text-muted-foreground' : 'text-red-600')}>
            {tamanhoOk ? `Cabem ${porFolha(d.largura, d.altura)} por folha A4.` : `Largura de ${LIMITES.largura.min} a ${LIMITES.largura.max} cm e altura de ${LIMITES.altura.min} a ${LIMITES.altura.max} cm (folha A4).`}
          </p>
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
          <p className="text-[11px] text-muted-foreground text-center">A4, com borda fina para recortar. Abre em outra aba — imprima ou salve.</p>
        </div>

        <form ref={formRef} method="post" action="/api/ferramentas/rotulo/pdf" target="_blank" className="hidden">
          <input type="hidden" name="dados" value={JSON.stringify(d)} readOnly />
        </form>

        <Secao titulo={d.familia === 'vela' ? 'O que precisa constar' : 'O que a ANVISA pede no rótulo'}>
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
            <p>
              {d.familia === 'vela'
                ? 'Vela não passa pela ANVISA, mas os avisos de segurança protegem você e a cliente. Não escreva "100% natural" se tem essência sintética — escreva o que é. Para vender em loja, o conteúdo (peso) no rótulo é obrigatório.'
                : 'Não escreva "hipoalergênico", "testado dermatologicamente", "natural" ou "orgânico" sem teste ou certificado — a fiscalização autua por isso. Para vender de verdade, cosmético (inclusive sabonete artesanal) precisa de notificação na ANVISA e de responsável técnico; o rótulo é a parte que dá para deixar certa agora.'}
            </p>
          </div>
        </Secao>
      </div>
    </div>
  )
}
