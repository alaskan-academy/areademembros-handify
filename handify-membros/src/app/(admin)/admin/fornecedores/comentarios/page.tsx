import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  adminGetReviews, adminApproveReview, adminDeleteReview,
  adminGetProductReviews, adminApproveProductReview, adminDeleteProductReview,
} from '@/lib/fornecedores/actions'
import { ArrowLeft, Check, Trash2 } from 'lucide-react'

export const metadata = { title: 'Admin — Comentários | Handify' }

export default async function AdminComentariosPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { aba } = await searchParams
  const tab = aba === 'produtos' ? 'produtos' : 'fornecedores'

  const [supplierPending, supplierApproved, productPending, productApproved] = await Promise.all([
    adminGetReviews(false),
    adminGetReviews(true),
    adminGetProductReviews(false),
    adminGetProductReviews(true),
  ])

  async function approveSupplier(id: string) {
    'use server'
    await adminApproveReview(id, true)
  }
  async function deleteSupplierReview(id: string) {
    'use server'
    await adminDeleteReview(id)
  }
  async function approveProduct(id: string) {
    'use server'
    await adminApproveProductReview(id, true)
  }
  async function deleteProductReview(id: string) {
    'use server'
    await adminDeleteProductReview(id)
  }

  const totalPending = supplierPending.length + productPending.length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/fornecedores" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Comentários</h1>
          {totalPending > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#6699F3] text-white text-[10px] font-bold">
              {totalPending}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        <Link
          href="/admin/fornecedores/comentarios"
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            tab === 'fornecedores' ? 'bg-white text-[#6699F3] shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Lojas e Marcas
          {supplierPending.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#6699F3] text-white text-[9px] font-bold">
              {supplierPending.length}
            </span>
          )}
        </Link>
        <Link
          href="/admin/fornecedores/comentarios?aba=produtos"
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            tab === 'produtos' ? 'bg-white text-[#6699F3] shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Materiais
          {productPending.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#6699F3] text-white text-[9px] font-bold">
              {productPending.length}
            </span>
          )}
        </Link>
      </div>

      {/* ── Aba Fornecedores ── */}
      {tab === 'fornecedores' && (
        <>
          <ReviewSection
            title="Aguardando aprovação"
            items={supplierPending}
            showApprove
            getEntityName={(r: any) => r.suppliers?.name}
            approveAction={approveSupplier}
            deleteAction={deleteSupplierReview}
          />
          <ReviewSection
            title={`Aprovados (${supplierApproved.length})`}
            items={supplierApproved}
            showApprove={false}
            getEntityName={(r: any) => r.suppliers?.name}
            approveAction={approveSupplier}
            deleteAction={deleteSupplierReview}
          />
        </>
      )}

      {/* ── Aba Produtos ── */}
      {tab === 'produtos' && (
        <>
          <ReviewSection
            title="Aguardando aprovação"
            items={productPending}
            showApprove
            getEntityName={(r: any) => r.products?.name}
            approveAction={approveProduct}
            deleteAction={deleteProductReview}
          />
          <ReviewSection
            title={`Aprovados (${productApproved.length})`}
            items={productApproved}
            showApprove={false}
            getEntityName={(r: any) => r.products?.name}
            approveAction={approveProduct}
            deleteAction={deleteProductReview}
          />
        </>
      )}
    </div>
  )
}

function ReviewSection({
  title,
  items,
  showApprove,
  getEntityName,
  approveAction,
  deleteAction,
}: {
  title: string
  items: any[]
  showApprove: boolean
  getEntityName: (r: any) => string | undefined
  approveAction: (id: string) => Promise<void>
  deleteAction: (id: string) => Promise<void>
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        {title}
        {showApprove && items.length > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#6699F3] text-white text-[10px] font-bold">
            {items.length}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {showApprove ? 'Nenhum comentário pendente.' : 'Nenhum comentário aprovado.'}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((r: any) => (
            <div key={r.id} className="bg-white rounded-lg border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-medium">{r.profiles?.full_name ?? 'Aluna'}</span>
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <span className="text-xs text-[#6699F3]">{getEntityName(r)}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(r.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80">{r.body}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {showApprove && (
                    <form action={approveAction.bind(null, r.id)}>
                      <button title="Aprovar" className="p-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                  <form action={deleteAction.bind(null, r.id)}>
                    <button title="Excluir" className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
