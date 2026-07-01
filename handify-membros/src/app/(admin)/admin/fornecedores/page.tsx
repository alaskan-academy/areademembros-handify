import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminGetSuppliers } from '@/lib/fornecedores/actions'
import { Plus, Edit, BadgeCheck, Store } from 'lucide-react'
import { PRODUCT_TAGS, CATEGORY_TAGS } from '@/lib/fornecedores/types'

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

      {/* Table */}
      <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/60">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Tags</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Canais</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                  Nenhum fornecedor cadastrado ainda.
                </td>
              </tr>
            ) : (
              suppliers.map((s: any) => {
                const tags = (s.supplier_tags ?? []).map((t: any) => t.tag)
                const channels = s.supplier_channels ?? []
                return (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.logo_url ? (
                          <img src={s.logo_url} alt="" className="w-8 h-8 rounded object-contain border border-border/40" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold">{s.name[0]}</div>
                        )}
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-xs">{s.name}</span>
                            {s.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#6699F3]" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground">pos. {s.position}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((t: string) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                        ))}
                        {tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{channels.length} canal{channels.length !== 1 ? 'is' : ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {s.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/fornecedores/${s.id}`}
                        className="inline-flex items-center gap-1 text-xs text-[#6699F3] hover:underline"
                      >
                        <Edit className="w-3 h-3" />
                        Editar
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
