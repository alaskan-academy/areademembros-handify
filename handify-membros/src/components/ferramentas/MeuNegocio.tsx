import Link from 'next/link'
import { cn } from '@/lib/utils'
import { reais } from '@/lib/ferramentas/calc'
import type { ResumoNegocio } from '@/lib/negocio/resumo'

/**
 * "Meu negócio" — o que precisa de atenção hoje, em uma olhada, no topo de
 * Ferramentas. Só para quem tem o Completo e já usa alguma ferramenta dele.
 */
export default function MeuNegocio({ r }: { r: ResumoNegocio }) {
  const dataBR = (iso: string) => iso.split('-').slice(1).reverse().join('/')
  const cards: { href: string; rotulo: string; valor: string; sub: string; alerta?: boolean }[] = [
    {
      href: '/ferramentas/pedidos',
      rotulo: 'Pedidos em aberto',
      valor: `${r.pedidosAbertos}`,
      sub: r.atrasados ? `${r.atrasados} atrasado${r.atrasados !== 1 ? 's' : ''}` : r.entregasSemana ? `${r.entregasSemana} até domingo` : r.pedidosAbertos ? `= ${reais(r.totalAbertos)}` : 'nada pendente',
      alerta: r.atrasados > 0,
    },
    {
      href: '/ferramentas/pedidos',
      rotulo: 'A receber',
      valor: reais(r.aReceber),
      sub: r.aReceber > 0 ? 'entre sinal e pendente' : 'tudo recebido',
    },
    {
      href: '/ferramentas/estoque',
      rotulo: 'Estoque',
      valor: r.insumosAcabando ? `${r.insumosAcabando} acabando` : 'em dia',
      sub: r.insumosVencendo ? `${r.insumosVencendo} vencendo` : 'nada vencendo',
      alerta: r.insumosAcabando > 0 || r.insumosVencendo > 0,
    },
    r.proximaData
      ? {
          href: '/ferramentas/calendario',
          rotulo: 'Próxima data',
          valor: `${r.proximaData.emoji} ${r.proximaData.nome}`,
          sub: r.proximaData.dias === 0 ? 'é hoje' : `${dataBR(r.proximaData.data)} — produzir até ${dataBR(r.proximaData.produzirAte)}`,
        }
      : { href: '/ferramentas/calendario', rotulo: 'Próxima data', valor: '—', sub: 'veja o calendário' },
  ]
  return (
    <section id="tour-ferramentas-negocio" className="rounded-2xl bg-[#0F0F0F] text-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Meu negócio</p>
        <p className="text-[11px] text-white/60">
          <Link href="/ferramentas/minhas-receitas" className="underline">{r.receitas} receita{r.receitas !== 1 ? 's' : ''}</Link>
          {' = '}
          <Link href="/ferramentas/catalogo" className="underline">{r.produtos} no catálogo</Link>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cards.map(c => (
          <Link key={c.rotulo} href={c.href} className={cn('rounded-xl p-3 handify-transition hover:bg-white/15', c.alerta ? 'bg-[#FEC649]/20' : 'bg-white/10')}>
            <p className="text-[11px] text-white/60">{c.rotulo}</p>
            <p className={cn('font-black leading-tight mt-0.5 truncate', c.valor.length > 12 ? 'text-sm' : 'text-lg')}>{c.valor}</p>
            <p className={cn('text-[11px] mt-0.5', c.alerta ? 'text-[#FEC649] font-semibold' : 'text-white/60')}>{c.sub}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
