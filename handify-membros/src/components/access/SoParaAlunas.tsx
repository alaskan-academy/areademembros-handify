import Link from 'next/link'
import { Lock, ArrowRight, Check } from 'lucide-react'

/**
 * Tela de quem ainda não é aluna ao abrir Comunidade ou Inspirações.
 *
 * A seção continua no menu e o clique funciona — o que muda é o que aparece.
 * Decisão da Jessica (04/09): não abrir a comunidade nem para leitura, porque
 * exporia projeto e foto das alunas para quem não é do grupo. Então em vez de
 * mostrar o conteúdo, mostramos o que tem lá dentro e o caminho para entrar.
 */
export default function SoParaAlunas({
  titulo,
  oQueTem,
  dentro,
  ferramentas = true,
}: {
  titulo: string
  /** Uma frase dizendo o que é a área. */
  oQueTem: string
  /** O que ela encontra lá dentro, quando for aluna. */
  dentro: string[]
  /** Mostra o atalho para as ferramentas grátis. */
  ferramentas?: boolean
}) {
  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-5">
        <div className="bg-white rounded-2xl border border-border/60 p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#6699F3]/10 border border-[#6699F3]/20 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-[#6699F3]" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F0F0F] leading-tight">{titulo}</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{oQueTem}</p>
          </div>

          <div className="rounded-xl bg-[#F5F5F0] p-4 text-left space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que tem aqui dentro</p>
            <ul className="space-y-1.5">
              {dentro.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-[#72CF92] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            É um espaço fechado, com as alunas mostrando o que fazem. Por respeito a elas, só quem tem um curso entra.
          </p>

          <Link
            href="/cursos"
            className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#6699F3] text-white text-sm font-semibold min-h-[48px] hover:bg-[#5580d4] handify-transition"
          >
            Ver os cursos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {ferramentas && (
          <div className="bg-white rounded-2xl border border-border/60 p-5 text-center space-y-2">
            <p className="text-sm font-semibold">Enquanto isso, use as ferramentas grátis</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A Meta de renda mostra quanto você precisa vender para ganhar o que quer por mês. O Deu problema? explica
              por que a vela afundou ou o sabonete suou. As duas são suas, sem pagar nada.
            </p>
            <Link href="/ferramentas" className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-[#6699F3] underline min-h-[44px]">
              Abrir Ferramentas <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
