import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminGetProducts } from '@/lib/fornecedores/actions'
import { Plus, Package } from 'lucide-react'
import { AdminProdutosTable } from '@/components/admin/AdminProdutosTable'

export const metadata = { title: 'Admin — Produtos | Handify' }

export default async function AdminProdutosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const products = await adminGetProducts()

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[#6699F3]" />
          <h1 className="text-xl font-bold">Produtos</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/fornecedores"
            className="text-xs px-3 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors"
          >
            ← Lojas
          </Link>
          <Link
            href="/admin/fornecedores/produtos/novo"
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-[#6699F3] text-white rounded-lg hover:bg-[#5588e8] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo produto
          </Link>
        </div>
      </div>

      <AdminProdutosTable products={products} />
    </div>
  )
}
