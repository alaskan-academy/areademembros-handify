import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSuppliers } from '@/lib/fornecedores/actions'
import { FornecedoresPage } from '@/components/ferramentas/fornecedores/FornecedoresPage'
import type { ProductTag } from '@/lib/fornecedores/types'

export const metadata = { title: 'Fornecedores | Handify' }

const VALID_PRODUCTS: ProductTag[] = ['velas', 'sabonetes']

export default async function FornecedoresRoute({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { produto } = await searchParams
  const initialProduto = VALID_PRODUCTS.includes(produto as ProductTag)
    ? (produto as ProductTag)
    : ''

  const suppliers = await getSuppliers(user.id)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <FornecedoresPage suppliers={suppliers} userId={user.id} initialProduto={initialProduto} />
    </div>
  )
}
