import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { adminGetProducts, adminGetSuppliers } from '@/lib/fornecedores/actions'
import { ProdutoForm } from '@/components/ferramentas/fornecedores/ProdutoForm'
import { Package } from 'lucide-react'

export const metadata = { title: 'Admin — Editar Produto | Handify' }

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { id } = await params

  const service = createServiceClient()
  const [products, suppliersRaw, { data: coursesRaw }] = await Promise.all([
    adminGetProducts(),
    adminGetSuppliers(),
    service.from('courses').select('id, title, slug').eq('published', true).order('title'),
  ])

  const product = products.find(p => p.id === id)
  if (!product) notFound()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-[#6699F3]" />
        <h1 className="text-xl font-bold">Editar produto</h1>
      </div>

      <ProdutoForm
        product={product}
        courses={(coursesRaw ?? []) as { id: string; title: string; slug: string }[]}
        suppliers={suppliersRaw.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          logo_url: s.logo_url,
          verified: s.verified,
          active: s.active,
          position: s.position,
          created_at: s.created_at,
          updated_at: s.updated_at,
        }))}
      />
    </div>
  )
}
