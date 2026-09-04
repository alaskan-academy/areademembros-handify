import { assertToolAccess } from '@/lib/ferramentas/access'
import Validade from '@/components/ferramentas/Validade'

export const metadata = {
  title: 'Validade do produto | Handify',
  description: 'Quanto tempo dura o que você fez, o que limita, e o texto pronto para o rótulo.',
}

export default async function ValidadePage() {
  // Sem isto o cadeado da lista seria só cosmético — bastava saber a URL.
  const dados = await assertToolAccess('validade-produto')
  // Os tipos de produto seguem o curso dela; Completo e admin veem todos.
  return <Validade categorias={dados.categorias} tudoLiberado={dados.tier === 'completo' || dados.tier === 'admin'} />
}
