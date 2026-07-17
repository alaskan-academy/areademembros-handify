import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { SupplierForm } from '@/components/ferramentas/fornecedores/SupplierForm'
import { Package, Pencil } from 'lucide-react'

export const metadata = { title: 'Admin — Editar Fornecedor | Handify' }

export default async function EditarFornecedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()
  const [{ data: supplier }, { data: categoriesRaw }, { data: linkedRaw }] = await Promise.all([
    service.from('suppliers').select('*, supplier_channels(*), supplier_tags(tag)').eq('id', id).single(),
    service.from('categories').select('id, name, slug').order('name'),
    service
      .from('product_supplier_links')
      .select('product_id, buy_url, products(id, name, image_url, active)')
      .eq('supplier_id', id),
  ])

  const categories = (categoriesRaw ?? []) as { id: string; name: string; slug: string }[]
  const linkedProducts = (linkedRaw ?? []).map((r: any) => ({
    id: r.products?.id as string,
    name: r.products?.name as string,
    image_url: r.products?.image_url as string | null,
    active: r.products?.active as boolean,
    buy_url: r.buy_url as string,
  })).filter(p => p.id)

  if (!supplier) notFound()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <SupplierForm supplier={supplier} categories={categories} />

      {/* Produtos vinculados */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-[#6699F3]" />
            Produtos vinculados ({linkedProducts.length})
          </h2>
          <Link
            href="/admin/fornecedores/produtos/novo"
            className="text-xs px-2.5 py-1.5 border border-[#6699F3]/40 text-[#6699F3] rounded-lg hover:bg-[#6699F3]/5 transition-colors"
          >
            + Novo produto
          </Link>
        </div>

        {linkedProducts.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-1">
            Nenhum produto vinculado a este fornecedor ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {linkedProducts.map(p => (
              <Link
                key={p.id}
                href={`/admin/fornecedores/produtos/${p.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-white hover:border-[#6699F3]/40 hover:bg-[#6699F3]/3 transition-colors group"
              >
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg border border-border/40 bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground/40" />
                  )}
                </div>

                {/* Nome + status */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  {!p.active && (
                    <span className="text-[10px] text-muted-foreground">Inativo</span>
                  )}
                </div>

                {/* Ícone editar */}
                <Pencil className="w-4 h-4 text-muted-foreground/40 group-hover:text-[#6699F3] transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
