import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSuppliers } from '@/lib/fornecedores/actions'
import { FornecedoresPage } from '@/components/ferramentas/fornecedores/FornecedoresPage'

export const metadata = { title: 'Fornecedores | Handify' }

export default async function FornecedoresRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const suppliers = await getSuppliers(user.id)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <FornecedoresPage suppliers={suppliers} userId={user.id} />
    </div>
  )
}
