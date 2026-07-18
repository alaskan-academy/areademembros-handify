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
  const [{ data: supplier }, { data: linkedRaw }] = await Promise.all([
    service.from('suppliers').select('*, supplier_channels(*), supplier_tags(tag)').eq('id', id).single(),
    service
      .from('product_supplier_links')
      .select('product_id, buy_url, products(id, name, image_url, active)')
      .eq('supplier_id', id),
  ])

  const linkedProducts = (linkedRaw ?? []).map((r: any) => ({
    id: r.products?.id as string,
    name: r.products?.name as string,
    image_url: r.products?.image_url as string | null,
    active: r.products?.active as boolean,
    buy_url: r.buy_url as string,
  })).filter(p => p.id)

  if (!supplier) notFound()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <SupplierForm supplier={supplier} linkedProducts={linkedProducts} />
    </div>
  )
}
