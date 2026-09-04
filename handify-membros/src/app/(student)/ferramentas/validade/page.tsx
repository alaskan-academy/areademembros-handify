import { assertToolAccess } from '@/lib/ferramentas/access'
import Validade from '@/components/ferramentas/Validade'

export const metadata = {
  title: 'Validade do produto | Handify',
  description: 'Quanto tempo dura o que você fez, o que limita, e o texto pronto para o rótulo.',
}

export default async function ValidadePage() {
  // Sem isto o cadeado da lista seria só cosmético — bastava saber a URL.
  await assertToolAccess('validade-produto')
  return <Validade />
}
