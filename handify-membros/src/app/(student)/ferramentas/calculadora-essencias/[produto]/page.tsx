import { notFound } from 'next/navigation'
import CalculadoraEssencias, { type EssenciasConfig } from '@/components/ferramentas/CalculadoraEssencias'

const CONFIGS: Record<string, EssenciasConfig> = {
  sabonetes: {
    produto: 'sabonetes',
    icon: '🧼',
    nome: 'Sabonetes Glicerinados',
    nomeSingular: 'sabonete',
    quantos: 'Quantos',
    pesoLabel: 'Peso de cada sabonete (g)',
    pesoPlaceholder: 'Ex: 90',
    pesoTooltip: 'Peso final do sabonete pronto, em gramas. Se não souber ainda, use 90g como estimativa.',
    tipoAlerta: 'lipo',
    alertaLabel: 'Para base glicerinada (sabonete sólido)',
    dicaAdicionar: 'Adicione na base glicerinada derretida entre 55–60°C e misture bem antes de verter na forma. Essência lipossolúvel incorpora facilmente na matriz do sabão.',
    rates: {
      essencia: { suave: 1, moderado: 2, intenso: 3 },
      oleo: { suave: 0.5, moderado: 1, intenso: 1.5 },
    },
  },
  velas: {
    produto: 'velas',
    icon: '🕯️',
    nome: 'Velas Artesanais',
    nomeSingular: 'vela',
    quantos: 'Quantas',
    pesoLabel: 'Quantidade de cera por vela (g)',
    pesoPlaceholder: 'Ex: 150',
    pesoTooltip: 'Peso da cera usada em cada vela, em gramas. Não inclui o peso do pote ou recipiente.',
    tipoAlerta: 'lipo',
    alertaLabel: 'Para velas artesanais',
    dicaAdicionar: 'Adicione na cera derretida entre 65–70°C, com o fogo já desligado. Mexa por 2 minutos antes de verter.',
    rates: {
      essencia: { suave: 5, moderado: 8, intenso: 10 },
      oleo: { suave: 3, moderado: 4, intenso: 5 },
    },
  },
}

export function generateStaticParams() {
  return Object.keys(CONFIGS).map(produto => ({ produto }))
}

export async function generateMetadata({ params }: { params: Promise<{ produto: string }> }) {
  const { produto } = await params
  const config = CONFIGS[produto]
  if (!config) return {}
  return { title: `Calculadora de Essências — ${config.nome} | Handify` }
}

export default async function CalculadoraEssenciasPage({
  params,
}: {
  params: Promise<{ produto: string }>
}) {
  const { produto } = await params
  const config = CONFIGS[produto]
  if (!config) notFound()
  return <CalculadoraEssencias config={config} />
}
