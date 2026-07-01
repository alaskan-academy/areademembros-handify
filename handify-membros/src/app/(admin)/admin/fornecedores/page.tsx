import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminGetSuppliers } from '@/lib/fornecedores/actions'
import { Plus, Store } from 'lucide-react'
import { AdminFornecedoresTable } from '@/components/admin/AdminFornecedoresTable'

export const metadata = { title: 'Admin — Fornecedores | Handify' }

export default async function AdminFornecedoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const suppliers = await adminGetSuppliers()

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-[#6699F3]" />
          <h1 className="text-xl font-bold">Fornecedores</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/fornecedores/comentarios"
            className="text-xs px-3 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors"
          >
            Comentários
          </Link>
          <Link
            href="/admin/fornecedores/sugestoes"
            className="text-xs px-3 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors"
          >
            Sugestões
          </Link>
          <Link
            href="/admin/fornecedores/novo"
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-[#6699F3] text-white rounded-lg hover:bg-[#5588e8] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo fornecedor
          </Link>
        </div>
      </div>

      <AdminFornecedoresTable suppliers={suppliers} />
    </div>
  )
}
