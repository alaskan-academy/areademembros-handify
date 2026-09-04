import { assertToolAccess } from '@/lib/ferramentas/access'
import { getViewer } from '@/lib/auth/access'
import { createClient } from '@/lib/supabase/server'
import Rotulo from '@/components/ferramentas/Rotulo'
import { familiasLiberadas, type DadosRotulo } from '@/lib/rotulo/tipos'

export const metadata = {
  title: 'Rótulo do produto | Handify',
  description: 'Sabonete, cosmético ou vela — o que precisa constar, bonito e pronto para imprimir.',
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

type Params = { fabricacao?: string; validade?: string; lote?: string; produto?: string; peso?: string; ingredientes?: string; familia?: string }

export default async function RotuloPage({ searchParams }: { searchParams: Promise<Params> }) {
  // Sem isto o cadeado da lista seria só cosmético — bastava saber a URL.
  const dados = await assertToolAccess('rotulo-sabonete')
  const [{ fabricacao, validade, lote, produto, peso, ingredientes, familia }, { userId }] = await Promise.all([searchParams, getViewer()])

  // Sabonete/cosmético ou vela: segue o curso dela; Completo e admin veem os dois.
  const familias = familiasLiberadas(dados.categorias, dados.tier === 'completo' || dados.tier === 'admin')

  // Quem tem a marca no Catálogo (Completo) já entra com ela preenchida. A dona
  // sempre lê o que é dela, mesmo com o plano vencido.
  const marca: Partial<DadosRotulo> = {}
  if (userId) {
    const supabase = await createClient()
    const { data } = await supabase.from('business_profile').select('brand_name, whatsapp, instagram, city').eq('user_id', userId).maybeSingle()
    if (data?.brand_name) {
      marca.marca = data.brand_name as string
      marca.fabricante = data.brand_name as string
      marca.contato = [
        data.whatsapp && `WhatsApp ${data.whatsapp}`,
        data.instagram && ((data.instagram as string).startsWith('@') ? data.instagram : `@${data.instagram}`),
        data.city,
      ]
        .filter(Boolean)
        .join(' | ')
    }
  }

  // Vindo da Validade: fabricação, validade e lote já calculados.
  const inicial: Partial<DadosRotulo> = {}
  if (fabricacao && ISO.test(fabricacao)) inicial.fabricacao = fabricacao
  if (validade && ISO.test(validade)) inicial.validade = validade
  if (lote) inicial.lote = lote.slice(0, 20)
  // Vindo da receita: nome, peso, ingredientes e família.
  if (produto) inicial.produto = produto.slice(0, 80)
  if (peso) inicial.peso = peso.slice(0, 20)
  if (ingredientes) inicial.ingredientes = ingredientes.slice(0, 600)
  if ((familia === 'vela' || familia === 'cosmetico') && familias.includes(familia)) inicial.familia = familia

  return <Rotulo marca={marca} inicial={inicial} familias={familias} />
}
