import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { SupplierForm } from '@/components/ferramentas/fornecedores/SupplierForm'

export const metadata = { title: 'Admin — Editar Fornecedor | Handify' }

export default async function EditarFornecedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()
  const [{ data: supplier }, { data: categoriesRaw }] = await Promise.all([
    service.from('suppliers').select('*, supplier_channels(*), supplier_tags(tag)').eq('id', id).single(),
    service.from('categories').select('id, name, slug').order('name'),
  ])
  const categories = (categoriesRaw ?? []) as { id: string; name: string; slug: string }[]

  if (!supplier) notFound()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <SupplierForm supplier={supplier} categories={categories} />
    </div>
  )
}
