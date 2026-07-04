import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { SupplierForm } from '@/components/ferramentas/fornecedores/SupplierForm'

export const metadata = { title: 'Admin — Novo Fornecedor | Handify' }

export default async function NovoFornecedorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()
  const { data: categoriesRaw } = await service.from('categories').select('id, name, slug').order('name')
  const categories = (categoriesRaw ?? []) as { id: string; name: string; slug: string }[]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <SupplierForm categories={categories} />
    </div>
  )
}
