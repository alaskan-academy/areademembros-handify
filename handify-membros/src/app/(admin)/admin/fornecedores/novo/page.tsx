import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTagTypes } from '@/lib/fornecedores/actions'
import { SupplierForm } from '@/components/ferramentas/fornecedores/SupplierForm'

export const metadata = { title: 'Admin — Novo Fornecedor | Handify' }

export default async function NovoFornecedorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const tagTypes = await getTagTypes()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <SupplierForm tagTypes={tagTypes} />
    </div>
  )
}
