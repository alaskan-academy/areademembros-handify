import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Target, Stethoscope, Calculator, Check, ArrowDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CadastroGratuito from './CadastroGratuito'

/**
 * Página pública das ferramentas grátis — a porta de entrada da Handify para
 * quem ainda não é aluna. Mostra o que ela consegue fazer hoje, de graça, e
 * pede só o necessário para criar a conta. Quem já está logada vai direto para
 * as ferramentas.
 *
 * Fase 4 do plano em .claude/plans/tiers-handify.md.
 */

export const metadata = {
  title: 'Ferramentas grátis para quem faz artesanato | Handify',
  description:
    'Descubra quanto cobrar, quanto precisa vender por mês e por que a sua vela afundou. Ferramentas grátis da Handify, sem cartão.',
}

const FERRAMENTAS = [
  {
    icone: Target,
    nome: 'Meta de renda',
    frase: 'Quanto você precisa vender para ganhar o que quer',
    texto:
      'Você diz quanto quer ganhar por mês. Ela mostra quantas peças por mês, por semana e por dia — e se isso cabe no tempo que você tem.',
    exemplo: 'Para R$ 2.000 por mês = 134 peças = 7 por dia',
  },
  {
    icone: Calculator,
    nome: 'Quanto cobrar',
    frase: 'O preço certo, com o seu trabalho contado',
    texto:
      'Você põe o que gastou de material, embalagem e tempo. Ela devolve o custo real de cada peça e por quanto vender para ter lucro de verdade.',
    exemplo: 'Sabonete de 90 g: custo R$ 6,61 = venda R$ 11,01',
  },
  {
    icone: Stethoscope,
    nome: 'Deu problema?',
    frase: 'Por que deu errado e como consertar',
    texto:
      'A vela afundou, fez túnel ou apagou sozinha. O sabonete suou ou ficou mole. Você procura pelo que aconteceu e aparece a causa, o conserto e como evitar na próxima.',
    exemplo: '26 problemas explicados, de velas a cosméticos',
  },
]

export default async function ComecarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/ferramentas')

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="brand-stripe">
        <span />
        <span />
        <span />
      </div>

      <header className="px-4 pt-8 pb-2 sm:pt-12">
        <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-5">
          <Image src="/logo-vertical-azul.png" alt="Handify" width={120} height={120} className="h-auto w-[92px] sm:w-[110px]" priority />
          <h1 className="text-[26px] sm:text-4xl font-black text-[#0F0F0F] leading-[1.15] max-w-xl">
            Descubra <span className="text-[#6699F3]">quanto cobrar</span> pelo que você faz com as mãos
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
            Três ferramentas grátis para quem faz sabonete, vela ou cosmético em casa. Sem cartão, sem prazo, sem pegadinha.
          </p>
          <a
            href="#criar-conta"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6699F3] text-white text-base font-bold px-7 min-h-[56px] hover:bg-[#5580d4] handify-transition"
          >
            Começar agora, é grátis <ArrowDown className="w-4 h-4" />
          </a>
        </div>
      </header>

      <section className="px-4 py-10 sm:py-14">
        <div className="max-w-2xl mx-auto space-y-4">
          {FERRAMENTAS.map(f => {
            const Icone = f.icone
            return (
              <div key={f.nome} className="bg-white rounded-2xl border border-border/60 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-[#6699F3]/10 border border-[#6699F3]/20 flex items-center justify-center">
                    <Icone className="w-6 h-6 text-[#6699F3]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-[#0F0F0F] leading-tight">{f.nome}</h2>
                    <p className="text-sm font-semibold text-[#6699F3] mt-0.5">{f.frase}</p>
                    <p className="text-[15px] text-muted-foreground leading-relaxed mt-2">{f.texto}</p>
                    <p className="mt-3 inline-block rounded-lg bg-[#F5F5F0] px-3 py-1.5 text-sm font-semibold text-[#2D2D2D]">{f.exemplo}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section id="criar-conta" className="px-4 pb-12 scroll-mt-6">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-border/60 p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-5">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-black text-[#0F0F0F] leading-tight">Crie sua conta e use agora</h2>
            <p className="text-sm text-muted-foreground mt-1.5">Leva um minuto. As três ferramentas abrem na hora.</p>
          </div>
          <CadastroGratuito />
        </div>
      </section>

      <section className="px-4 pb-14">
        <div className="max-w-2xl mx-auto bg-[#0F0F0F] text-white rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-lg sm:text-xl font-black leading-tight">E quando você quiser aprender a fazer</h2>
          <p className="text-[15px] text-white/80 leading-relaxed">
            As ferramentas mostram o resultado. Os cursos ensinam o caminho: saboaria, velas, cosméticos e aromas, com aula
            em vídeo, professora respondendo e certificado no fim.
          </p>
          <ul className="space-y-2">
            {[
              'Aula em vídeo, no seu tempo, quantas vezes quiser',
              'Comunidade com a professora respondendo as suas dúvidas',
              'Certificado com o seu nome ao concluir',
            ].map(i => (
              <li key={i} className="flex items-start gap-2 text-[15px]">
                <Check className="w-4 h-4 text-[#72CF92] shrink-0 mt-1" />
                <span className="text-white/85">{i}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-white/60">Crie a conta primeiro e conheça os cursos por dentro, sem compromisso.</p>
        </div>
      </section>

      <footer className="px-4 pb-12">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <div className="brand-stripe max-w-[160px] mx-auto rounded-full overflow-hidden">
            <span />
            <span />
            <span />
          </div>
          <p className="text-xs text-muted-foreground">
            Handify™ — um espaço feito para aprender e criar.
            <br />
            Já é aluna?{' '}
            <Link href="/login" className="text-[#6699F3] font-semibold underline">
              Entrar na sua conta
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
