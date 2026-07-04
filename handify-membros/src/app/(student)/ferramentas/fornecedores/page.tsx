import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSuppliers } from '@/lib/fornecedores/actions'
import { FornecedoresPage } from '@/components/ferramentas/fornecedores/FornecedoresPage'

export const metadata = { title: 'Fornecedores | Handify' }

export default async function FornecedoresRoute({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const [suppliers, { data: categoriesRaw }] = await Promise.all([
    getSuppliers(user.id),
    service.from('categories').select('id, name, slug').order('name'),
  ])
  const categories = (categoriesRaw ?? []) as { id: string; name: string; slug: string }[]

  const { produto } = await searchParams
  const validSlugs = categories.map(c => c.slug)
  const initialProduto = produto && validSlugs.includes(produto) ? produto : ''

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <FornecedoresPage
        suppliers={suppliers}
        userId={user.id}
        categories={categories}
        initialProduto={initialProduto}
      />
    </div>
  )
}
