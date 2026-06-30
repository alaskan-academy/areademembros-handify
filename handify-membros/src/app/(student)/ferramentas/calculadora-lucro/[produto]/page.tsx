import { notFound } from 'next/navigation'
import CalculadoraLucro, { type ProdutoConfig } from '@/components/ferramentas/CalculadoraLucro'

const CONFIGS: Record<string, ProdutoConfig> = {
  sabonetes: {
    icon: '🧼',
    nome: 'Sabonetes Glicerinados',
    nomeSingular: 'sabonete',
    subtitulo: 'Descubra por quanto vender para ter lucro — e o quanto você vai realmente ganhar.',
    namePlaceholder: 'Como você chama esse sabonete?',
    batchLabel: 'Quantas unidades por lote?',
    batchPlaceholder: 'Ex: 20',
    unitLabel: 'Peso de cada unidade (g)',
    unitPlaceholder: 'Ex: 90',
    mpTips: 'Base glicerinada, óleo essencial, corante em gel, mica, glitter cosmético, vitamina E, fragrância...',
    mpItemPlaceholder: 'Ex: Base glicerinada',
    embItemPlaceholder: 'Ex: Rótulo kraft',
    embScopeLabel: 'por sabonete',
    embTipsUnit: 'Papel crepom, rótulo, fita, caixinha kraft, saquinho celofane...',
    embTipsLote: 'Saco de envio dos pedidos, caixa de papelão para transporte, fita adesiva...',
    defaultProductName: 'Seu sabonete',
    storageKey: 'handify_recipes_sabonetes',
  },
  velas: {
    icon: '🕯️',
    nome: 'Velas Artesanais',
    nomeSingular: 'vela',
    subtitulo: 'Descubra por quanto vender para ter lucro — e o quanto você vai realmente ganhar.',
    namePlaceholder: 'Como você chama essa vela?',
    batchLabel: 'Quantas velas por lote?',
    batchPlaceholder: 'Ex: 12',
    unitLabel: 'Quantidade de cera por vela (g)',
    unitPlaceholder: 'Ex: 150',
    mpTips: 'Cera de soja, cera de parafina, cera de coco, essência/fragrância, corante em bloco ou líquido, pavio...',
    mpItemPlaceholder: 'Ex: Cera de soja',
    embItemPlaceholder: 'Ex: Pote de vidro',
    embScopeLabel: 'por vela',
    embTipsUnit: 'Recipiente/pote de vidro, tampa, rótulo, etiqueta, cordão decorativo, celofane...',
    embTipsLote: 'Caixa de papelão para transporte, saco de envio, fita adesiva, papel de seda...',
    defaultProductName: 'Sua vela',
    storageKey: 'handify_recipes_velas',
  },
}

export function generateStaticParams() {
  return Object.keys(CONFIGS).map(produto => ({ produto }))
}

export async function generateMetadata({ params }: { params: Promise<{ produto: string }> }) {
  const { produto } = await params
  const config = CONFIGS[produto]
  if (!config) return {}
  return { title: `Calculadora de Lucro — ${config.nome} | Handify` }
}

export default async function CalculadoraPage({
  params,
}: {
  params: Promise<{ produto: string }>
}) {
  const { produto } = await params
  const config = CONFIGS[produto]
  if (!config) notFound()
  return <CalculadoraLucro config={config} />
}
